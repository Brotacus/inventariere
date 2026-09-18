from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine, ensure_schema_compatibility
from app.routes import auth, admin, devices, journal, locations, loans, logs, notifications, people, public_assets
from app.services.auth_service import is_session_valid

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Inventory API",
    version="0.6.0",
)

# Paths that must remain reachable before authentication. Uploaded images are
# kept public because the current React gallery uses normal <img src="...">
# requests, which cannot attach the Bearer header by themselves.
PUBLIC_EXACT_PATHS = {
    "/",
    "/auth/login",
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
    "/openapi.json",
}
PUBLIC_PREFIXES = ("/uploads/", "/public/assets/")


@app.middleware("http")
async def require_admin_session(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path in PUBLIC_EXACT_PATHS or any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None

    if not is_session_valid(token):
        return JSONResponse(
            status_code=401,
            content={"detail": "Sesiunea de administrator lipsește sau a expirat."},
        )

    return await call_next(request)


# Keep CORS outside the authentication middleware so even 401 responses carry
# the headers required by the Vite frontend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    # Also allow the Vite frontend when it is opened through a private-LAN IP,
    # which is useful when a QR label is scanned from a phone during testing.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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
        "docs": "/docs",
        "version": "0.6.0",
        "authentication": "admin-session",
    }
