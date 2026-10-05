import asyncio
import os
import re

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app import models
from app.database import Base, engine, ensure_schema_compatibility, get_db
from app.routes import auth, admin, devices, journal, locations, loans, logs, notifications, people, public_assets
from app.services.auth_service import get_session, is_session_valid
from app.services.security import UPLOAD_DIR
from app.services.security_middleware import RequestBodyLimitMiddleware

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

API_DOCS_ENABLED = os.getenv("ENABLE_API_DOCS", "false").lower() == "true"
app = FastAPI(
    title="Inventory API",
    version="0.6.0",
    docs_url="/docs" if API_DOCS_ENABLED else None,
    redoc_url="/redoc" if API_DOCS_ENABLED else None,
    openapi_url="/openapi.json" if API_DOCS_ENABLED else None,
)
_MUTATION_LOCKS: dict[asyncio.AbstractEventLoop, asyncio.Lock] = {}


def _mutation_lock() -> asyncio.Lock:
    # The production server has one event loop. TestClient may create a fresh
    # loop for each context, so an already-bound lock must not cross contexts.
    loop = asyncio.get_running_loop()
    for previous_loop in list(_MUTATION_LOCKS):
        if previous_loop.is_closed():
            _MUTATION_LOCKS.pop(previous_loop, None)
    if loop not in _MUTATION_LOCKS:
        _MUTATION_LOCKS[loop] = asyncio.Lock()
    return _MUTATION_LOCKS[loop]


def _unauthorized_response() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"detail": "Sesiunea de administrator lipsește sau a expirat."},
    )

# Catalog images are public; only recorded raster photos have a serving route.
PUBLIC_EXACT_PATHS = {
    "/",
    "/auth/login",
    "/auth/methods",
}
if API_DOCS_ENABLED:
    # Documentation is an explicit development opt-in, disabled by default.
    PUBLIC_EXACT_PATHS.update({"/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"})
PUBLIC_PREFIXES = ("/uploads/", "/public/assets/")


@app.middleware("http")
async def require_admin_session(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    public = path in PUBLIC_EXACT_PATHS or any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES)

    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None

    admin = None if public else get_session(token)
    if not public and admin is None:
        return _unauthorized_response()
    request.state.admin = admin

    if not public and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        # Keep backups, image writes, resets and inventory changes consistent in
        # this application's single-process deployment. Reads stay concurrent.
        async with _mutation_lock():
            # Logout or expiry while a request was queued must revoke its write.
            if not public and not is_session_valid(token):
                return _unauthorized_response()
            return await call_next(request)
    return await call_next(request)


# Reject oversized bodies before buffering/parsing. CORS and security response
# middleware stay outside this layer, including for an early 413 response.
app.add_middleware(RequestBodyLimitMiddleware)

# Keep CORS outside authentication so 401 and 413 responses reach the frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip() and origin.strip() != "*"],
    # Also allow the Vite frontend when it is opened through a private-LAN IP,
    # which is useful when a QR label is scanned from a phone during testing.
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):5173$"
        if os.getenv("CORS_ALLOW_LAN", "true").lower() == "true" else None
    ),
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def secure_responses(request: Request, call_next):
    response = await call_next(request)
    response.headers.update(_security_headers(request))
    return response


def _security_headers(request: Request) -> dict[str, str]:
    headers = {
        "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer", "Cache-Control": "no-store",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    }
    if request.url.path not in {"/docs", "/redoc", "/docs/oauth2-redirect"}:
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    if request.url.scheme == "https":
        headers["Strict-Transport-Security"] = "max-age=31536000"
    return headers


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    # Keep unexpected internal errors generic and prevent caching their output.
    return JSONResponse(
        status_code=500,
        content={"detail": "A apărut o eroare internă. Încearcă din nou."},
        headers=_security_headers(request),
    )


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    # Never echo passwords or arbitrary request bodies back in validation
    # errors. Invalid Unicode input can also crash the default JSON renderer.
    def safe_text(value):
        return value.encode("utf-8", errors="replace").decode("utf-8") if isinstance(value, str) else value

    details = [{
        "loc": [safe_text(part) for part in error.get("loc", ())],
        "msg": safe_text(error.get("msg", "Date invalide.")),
        "type": safe_text(error.get("type", "value_error")),
    } for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": details})


@app.api_route("/uploads/devices/{device_id}/{filename}", methods=["GET", "HEAD"], include_in_schema=False)
def get_public_photo(device_id: int, filename: str, db: Session = Depends(get_db)):
    if device_id <= 0 or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", filename):
        raise HTTPException(status_code=404, detail="Fotografia nu există.")
    image = db.query(models.DeviceImage).filter(
        models.DeviceImage.device_id == device_id,
        models.DeviceImage.stored_name == filename,
        models.DeviceImage.content_type.in_({"image/png", "image/jpeg", "image/webp"}),
    ).first()
    if image is None:
        raise HTTPException(status_code=404, detail="Fotografia nu există.")
    target = (UPLOAD_DIR / "devices" / str(device_id) / filename).resolve()
    if UPLOAD_DIR not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Fotografia nu există.")
    return FileResponse(target, media_type=image.content_type)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(people.router)
app.include_router(locations.router)
app.include_router(loans.router)
app.include_router(logs.router)
app.include_router(journal.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(public_assets.router)


@app.get("/")
def home():
    return {
        "message": "Inventory API works",
        "docs": "/docs" if API_DOCS_ENABLED else None,
        "version": "0.6.0",
        "authentication": "admin-session",
    }
