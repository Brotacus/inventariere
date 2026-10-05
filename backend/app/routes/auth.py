import time
from threading import Lock
from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import ldap_auth
from app.services.audit import record_activity
from app.services.auth_service import (
    LOCAL_ADMIN,
    AdminIdentity,
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
    # A username selects LDAP login; without one the local admin password is used.
    username: str | None = Field(default=None, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class AdminLoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_in: int
    admin: str = "Administrator"
    username: str
    method: str


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


def _reject_login(key: str, status_code: int, detail: str) -> NoReturn:
    lockout = _record_failed_attempt(key)
    if lockout:
        raise HTTPException(
            status_code=429,
            detail=f"Prea multe încercări. Accesul a fost blocat pentru {lockout} secunde.",
            headers={"Retry-After": str(lockout)},
        )
    raise HTTPException(status_code=status_code, detail=detail)


def _identity_payload(identity: AdminIdentity) -> dict:
    return {"admin": identity.display_name, "username": identity.username, "method": identity.method}


def _ldap_identity(key: str, username: str, password: str) -> AdminIdentity:
    try:
        user = ldap_auth.authenticate(username, password)
    except ldap_auth.LdapInvalidCredentials:
        _reject_login(key, 401, "Utilizator sau parolă incorectă")
    except ldap_auth.LdapNotAuthorized:
        _reject_login(key, 403, "Contul nu are acces la administrarea inventarului.")
    except ldap_auth.LdapUnavailable:
        # A directory outage is not the user's mistake; it never counts as a
        # failed attempt. The reason is logged by the LDAP service.
        raise HTTPException(status_code=503, detail="Serverul LDAP nu este disponibil. Încearcă din nou.") from None
    return AdminIdentity(username=user.username, display_name=user.display_name, method="ldap")


@router.get("/methods")
def login_methods():
    return {"password": bool(get_configured_password()), "ldap": ldap_auth.ldap_enabled()}


@router.post("/login", response_model=AdminLoginResponse)
def login_admin(
    payload: AdminLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    username = (payload.username or "").strip()
    if username and not ldap_auth.ldap_enabled():
        raise HTTPException(status_code=503, detail="LDAP_SERVER_URI is not configured in backend/.env")
    if not username and not get_configured_password():
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

    if username:
        identity = _ldap_identity(key, username, payload.password)
    elif password_is_valid(payload.password):
        identity = LOCAL_ADMIN
    else:
        _reject_login(key, 401, "Parolă incorectă")

    _clear_failed_attempts(key)
    token, ttl = create_session(identity)

    record_activity(
        db,
        event_type="ADMIN_LOGIN",
        category="SECURITY",
        title="Autentificare administrator",
        description=(
            f"{identity.display_name} ({identity.username}) s-a autentificat prin LDAP."
            if identity.method == "ldap" else "Administratorul s-a autentificat în aplicație."
        ),
        details={"client": key, "username": identity.username, "method": identity.method},
    )
    try:
        db.commit()
    except Exception:
        revoke_session(token)
        raise

    return AdminLoginResponse(token=token, expires_in=ttl, **_identity_payload(identity))


@router.get("/me")
def current_admin(request: Request):
    # Authentication for this endpoint is enforced by the application middleware.
    return {"authenticated": True, **_identity_payload(request.state.admin)}


@router.post("/logout")
def logout_admin(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else None
    revoke_session(token)
    identity: AdminIdentity = request.state.admin

    record_activity(
        db,
        event_type="ADMIN_LOGOUT",
        category="SECURITY",
        title="Deconectare administrator",
        description=(
            f"Sesiunea lui {identity.display_name} ({identity.username}) a fost închisă."
            if identity.method == "ldap" else "Sesiunea administratorului a fost închisă."
        ),
        details={"username": identity.username, "method": identity.method},
    )
    db.commit()

    return {"message": "Logged out"}
