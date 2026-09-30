import json
import os
import re
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.engine import make_url

from app.database import DATABASE_URL
from app.services.security import UPLOAD_DIR


class BackupError(RuntimeError):
    """The complete recovery point could not be created."""


def _sqlite_path() -> Path | None:
    url = make_url(DATABASE_URL)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        return None
    return Path(url.database).resolve()


def create_database_backup(label: str = "manual") -> str | None:
    """Atomically create a checked ZIP with a SQLite snapshot and its photos.

    HTTP mutations are serialized by main.py during this operation so file and
    database writes cannot produce a mixed snapshot in the single-process app.
    """
    source_path = _sqlite_path()
    if source_path is None or not source_path.is_file():
        return None

    backup_dir = Path(os.getenv("BACKUP_DIR") or source_path.parent / "backups").resolve()
    if backup_dir == UPLOAD_DIR or UPLOAD_DIR in backup_dir.parents:
        raise BackupError("BACKUP_DIR must be outside UPLOAD_DIR")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    safe_label = re.sub(r"[^a-zA-Z0-9_-]", "_", label)[:40] or "manual"
    backup_path = backup_dir / f"inventory_{timestamp}_{safe_label}.zip"

    try:
        backup_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="inventory-backup-", dir=backup_dir) as scratch:
            scratch_dir = Path(scratch)
            database_copy = scratch_dir / "inventory.db"
            with closing(sqlite3.connect(source_path)) as source:
                with closing(sqlite3.connect(database_copy)) as destination:
                    source.backup(destination)
                    if destination.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                        raise BackupError("SQLite recovery snapshot failed validation")

            archive_path = scratch_dir / "archive.zip"
            file_count = 0
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.write(database_copy, "inventory.db")
                if UPLOAD_DIR.exists():
                    for photo in UPLOAD_DIR.rglob("*"):
                        # Never follow a link outside the inventory storage.
                        if photo.is_symlink() or (hasattr(photo, "is_junction") and photo.is_junction()):
                            raise BackupError("Linked files are not permitted in inventory uploads")
                        if photo.is_file():
                            archive.write(photo, "uploads/" + photo.relative_to(UPLOAD_DIR).as_posix())
                            file_count += 1
                archive.writestr("manifest.json", json.dumps({
                    "format": 1,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "database": "inventory.db",
                    "uploads": "uploads/",
                    "uploaded_files": file_count,
                }, ensure_ascii=False, indent=2))

            with zipfile.ZipFile(archive_path) as archive:
                if archive.testzip() is not None:
                    raise BackupError("Recovery archive failed validation")
            archive_path.replace(backup_path)
    except BackupError:
        raise
    except (OSError, sqlite3.Error, zipfile.BadZipFile) as exc:
        raise BackupError("Recovery archive could not be created") from exc

    return str(backup_path)
