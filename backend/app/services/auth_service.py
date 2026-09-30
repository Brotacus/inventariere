import hashlib
import os
import secrets
import time
from threading import Lock

from app.services.security import secrets_match

# Sessions intentionally live in process memory. For this development app that
# means a backend restart invalidates every admin session automatically.
_SESSIONS: dict[str, tuple[float, bytes]] = {}
_LOCK = Lock()
MAX_SESSIONS = 1000


def _session_ttl_seconds() -> int:
    try:
        return min(86400, max(300, int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "43200"))))
    except ValueError:
        return 43200


def get_configured_password() -> str | None:
    # Reset authorization must never double as a login credential.
    return os.getenv("ADMIN_PASSWORD") or None


def password_is_valid(password: str) -> bool:
    expected = get_configured_password()
    if not expected:
        return False
    return secrets_match(password, expected)


def _credential_fingerprint() -> bytes:
    password = get_configured_password() or ""
    return hashlib.sha256(password.encode("utf-8", errors="surrogatepass")).digest()


def create_session() -> tuple[str, int]:
    ttl = _session_ttl_seconds()
    token = secrets.token_urlsafe(48)
    expires_at = time.monotonic() + ttl

    with _LOCK:
        _purge_expired_locked()
        # Bound memory even when one authenticated client creates many sessions.
        if len(_SESSIONS) >= MAX_SESSIONS:
            _SESSIONS.pop(next(iter(_SESSIONS)))
        _SESSIONS[token] = (expires_at, _credential_fingerprint())

    return token, ttl


def is_session_valid(token: str | None) -> bool:
    if not token or len(token) > 128:
        return False

    now = time.monotonic()
    with _LOCK:
        session = _SESSIONS.get(token)
        if session is None:
            return False
        expires_at, fingerprint = session
        if expires_at <= now or fingerprint != _credential_fingerprint():
            _SESSIONS.pop(token, None)
            return False
        return True


def revoke_session(token: str | None) -> None:
    if not token:
        return
    with _LOCK:
        _SESSIONS.pop(token, None)


def _purge_expired_locked() -> None:
    now = time.monotonic()
    fingerprint = _credential_fingerprint()
    expired = [
        token for token, (expires_at, saved_fingerprint) in _SESSIONS.items()
        if expires_at <= now or saved_fingerprint != fingerprint
    ]
    for token in expired:
        _SESSIONS.pop(token, None)
