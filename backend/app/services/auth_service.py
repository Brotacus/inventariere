import hmac
import os
import secrets
import time
from threading import Lock

# Sessions intentionally live in process memory. For this development app that
# means a backend restart invalidates every admin session automatically.
_SESSIONS: dict[str, float] = {}
_LOCK = Lock()


def _session_ttl_seconds() -> int:
    try:
        return max(300, int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "43200")))
    except ValueError:
        return 43200


def get_configured_password() -> str | None:
    # ADMIN_PASSWORD is the dedicated setting. Falling back to ADMIN_CLEAR_CODE
    # keeps existing test installations working when both codes are identical.
    return os.getenv("ADMIN_PASSWORD") or os.getenv("ADMIN_CLEAR_CODE")


def password_is_valid(password: str) -> bool:
    expected = get_configured_password()
    if not expected:
        return False
    return hmac.compare_digest(password, expected)


def create_session() -> tuple[str, int]:
    ttl = _session_ttl_seconds()
    token = secrets.token_urlsafe(48)
    expires_at = time.time() + ttl

    with _LOCK:
        _purge_expired_locked()
        _SESSIONS[token] = expires_at

    return token, ttl


def is_session_valid(token: str | None) -> bool:
    if not token:
        return False

    now = time.time()
    with _LOCK:
        expires_at = _SESSIONS.get(token)
        if expires_at is None:
            return False
        if expires_at <= now:
            _SESSIONS.pop(token, None)
            return False
        return True


def revoke_session(token: str | None) -> None:
    if not token:
        return
    with _LOCK:
        _SESSIONS.pop(token, None)


def _purge_expired_locked() -> None:
    now = time.time()
    expired = [token for token, expires_at in _SESSIONS.items() if expires_at <= now]
    for token in expired:
        _SESSIONS.pop(token, None)
