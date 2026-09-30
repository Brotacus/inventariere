"""Shared storage paths and safe credential comparison."""

import hmac
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR") or BACKEND_DIR / "uploads").resolve()


def secrets_match(provided: str, expected: str) -> bool:
    # compare_digest only accepts ASCII for str arguments. Byte comparison also
    # handles Romanian characters and malformed Unicode without an API crash.
    return hmac.compare_digest(
        provided.encode("utf-8", errors="surrogatepass"),
        expected.encode("utf-8", errors="surrogatepass"),
    )
