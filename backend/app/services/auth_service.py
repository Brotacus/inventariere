import hashlib
import os
import secrets
import time
from dataclasses import dataclass
from threading import Lock

from app.services import ldap_auth
from app.services.security import secrets_match


@dataclass(frozen=True)
class AdminIdentity:
    username: str
    display_name: str
    method: str  # "password" (shared local admin) or "ldap"


LOCAL_ADMIN = AdminIdentity(username="admin", display_name="Administrator", method="password")

# Sessions intentionally live in process memory. For this development app that
# means a backend restart invalidates every admin session automatically.
_SESSIONS: dict[str, tuple[float, bytes | None, AdminIdentity]] = {}
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


def _credential_fingerprint(method: str) -> bytes | None:
    # Changing the admin password or the LDAP settings revokes the sessions
    # issued under the old value; disabling a method revokes all of them.
    if method == "ldap":
        secret = ldap_auth.config_fingerprint()
    else:
        secret = get_configured_password()
    if secret is None:
        return None
    return hashlib.sha256(f"{method}:{secret}".encode("utf-8", errors="surrogatepass")).digest()


def create_session(identity: AdminIdentity = LOCAL_ADMIN) -> tuple[str, int]:
    ttl = _session_ttl_seconds()
    token = secrets.token_urlsafe(48)
    expires_at = time.monotonic() + ttl

    with _LOCK:
        _purge_expired_locked()
        # Bound memory even when one authenticated client creates many sessions.
        if len(_SESSIONS) >= MAX_SESSIONS:
            _SESSIONS.pop(next(iter(_SESSIONS)))
        _SESSIONS[token] = (expires_at, _credential_fingerprint(identity.method), identity)

    return token, ttl


def get_session(token: str | None) -> AdminIdentity | None:
    if not token or len(token) > 128:
        return None

    now = time.monotonic()
    with _LOCK:
        session = _SESSIONS.get(token)
        if session is None:
            return None
        expires_at, fingerprint, identity = session
        if _session_expired(expires_at, fingerprint, identity, now):
            _SESSIONS.pop(token, None)
            return None
        return identity


def is_session_valid(token: str | None) -> bool:
    return get_session(token) is not None


def revoke_session(token: str | None) -> None:
    if not token:
        return
    with _LOCK:
        _SESSIONS.pop(token, None)


def _session_expired(expires_at: float, fingerprint: bytes | None, identity: AdminIdentity, now: float) -> bool:
    return (
        expires_at <= now
        or fingerprint is None
        or fingerprint != _credential_fingerprint(identity.method)
    )


def _purge_expired_locked() -> None:
    now = time.monotonic()
    expired = [
        token for token, session in _SESSIONS.items()
        if _session_expired(*session, now)
    ]
    for token in expired:
        _SESSIONS.pop(token, None)
