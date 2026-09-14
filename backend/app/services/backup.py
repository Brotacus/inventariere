import sqlite3
from datetime import datetime
from pathlib import Path

from app.database import DATABASE_URL


def _sqlite_path() -> Path | None:
    prefix = "sqlite:///"
    if not DATABASE_URL.startswith(prefix):
        return None
    return Path(DATABASE_URL[len(prefix):]).resolve()


def create_database_backup(label: str = "manual") -> str | None:
    source_path = _sqlite_path()
    if source_path is None or not source_path.exists():
        return None

    backup_dir = source_path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    backup_path = backup_dir / f"inventory_{timestamp}_{label}.db"

    source = sqlite3.connect(source_path)
    destination = sqlite3.connect(backup_path)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()

    return str(backup_path)
