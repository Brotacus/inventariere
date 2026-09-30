import time
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.audit import record_activity
from app.services.auth_service import (
    create_session,
    get_configured_password,
    password_is_valid,
    revoke_session,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 30
ATTEMPT_WINDOW_SECONDS = 300
MAX_TRACKED_CLIENTS = 4096
_FAILED_ATTEMPTS: dict[str, tuple[int, float, float]] = {}
_ATTEMPT_LOCK = Lock()


class AdminLoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class AdminLoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_in: int
    admin: str = "Administrator"


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _purge_failed_attempts_locked(now: float) -> None:
    expired = [
        key for key, (_, expires_at, locked_until) in _FAILED_ATTEMPTS.items()
        if max(expires_at, locked_until) <= now
    ]
    for key in expired:
        _FAILED_ATTEMPTS.pop(key, None)


def _remaining_lockout(key: str) -> int:
    now = time.monotonic()
    with _ATTEMPT_LOCK:
        _purge_failed_attempts_locked(now)
        _, _, locked_until = _FAILED_ATTEMPTS.get(key, (0, 0.0, 0.0))
        if locked_until > now:
            return max(1, int(locked_until - now + 0.999))
        if locked_until:
            _FAILED_ATTEMPTS.pop(key, None)
        return 0


def _record_failed_attempt(key: str) -> int:
    now = time.monotonic()
    with _ATTEMPT_LOCK:
        _purge_failed_attempts_locked(now)
        if key not in _FAILED_ATTEMPTS and len(_FAILED_ATTEMPTS) >= MAX_TRACKED_CLIENTS:
            oldest = min(_FAILED_ATTEMPTS, key=lambda item: _FAILED_ATTEMPTS[item][1])
            _FAILED_ATTEMPTS.pop(oldest, None)
        attempts, expires_at, locked_until = _FAILED_ATTEMPTS.get(key, (0, now + ATTEMPT_WINDOW_SECONDS, 0.0))
        if locked_until > now:
            return max(1, int(locked_until - now + 0.999))

        attempts += 1
        if attempts >= MAX_FAILED_ATTEMPTS:
            locked_until = now + LOCKOUT_SECONDS
            _FAILED_ATTEMPTS[key] = (0, expires_at, locked_until)
            return LOCKOUT_SECONDS

        _FAILED_ATTEMPTS[key] = (attempts, expires_at, 0.0)
        return 0


def _clear_failed_attempts(key: str) -> None:
    with _ATTEMPT_LOCK:
        _FAILED_ATTEMPTS.pop(key, None)


@router.post("/login", response_model=AdminLoginResponse)
def login_admin(
    payload: AdminLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    if not get_configured_password():
        raise HTTPException(
            status_code=503,
            detail="ADMIN_PASSWORD is not configured in backend/.env",
        )

    key = _client_key(request)
    remaining = _remaining_lockout(key)
    if remaining:
        raise HTTPException(
            status_code=429,
            detail=f"Prea multe încercări. Încearcă din nou peste {remaining} secunde.",
            headers={"Retry-After": str(remaining)},
        )

    if not password_is_valid(payload.password):
        lockout = _record_failed_attempt(key)
        if lockout:
            raise HTTPException(
                status_code=429,
                detail=f"Prea multe încercări. Accesul a fost blocat pentru {lockout} secunde.",
                headers={"Retry-After": str(lockout)},
            )
        raise HTTPException(status_code=401, detail="Parolă incorectă")

    _clear_failed_attempts(key)
    token, ttl = create_session()

    record_activity(
        db,
        event_type="ADMIN_LOGIN",
        category="SECURITY",
        title="Autentificare administrator",
        description="Administratorul s-a autentificat în aplicație.",
        details={"client": key},
    )
    try:
        db.commit()
    except Exception:
        revoke_session(token)
        raise

    return AdminLoginResponse(token=token, expires_in=ttl)


@router.get("/me")
def current_admin():
    # Authentication for this endpoint is enforced by the application middleware.
    return {"authenticated": True, "admin": "Administrator"}


@router.post("/logout")
def logout_admin(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None
    revoke_session(token)

    record_activity(
        db,
        event_type="ADMIN_LOGOUT",
        category="SECURITY",
        title="Deconectare administrator",
        description="Sesiunea administratorului a fost închisă.",
    )
    db.commit()

    return {"message": "Logged out"}
