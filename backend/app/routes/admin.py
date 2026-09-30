import logging
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import begin_inventory_write, get_db
from app.services.backup import BackupError, create_database_backup
from app.services.security import UPLOAD_DIR, secrets_match

router = APIRouter(prefix="/admin", tags=["Admin"])

UPLOAD_ROOT = UPLOAD_DIR
logger = logging.getLogger(__name__)


def _required_backup(label: str) -> str:
    try:
        path = create_database_backup(label)
    except BackupError:
        logger.exception("Inventory recovery point could not be created")
        raise HTTPException(status_code=503, detail="Copia de siguranță nu a putut fi creată. Datele au fost păstrate.")
    if path is None:
        raise HTTPException(status_code=503, detail="Este necesară o bază SQLite disponibilă pentru copia de siguranță.")
    return path


@router.get("/dashboard")
def get_admin_dashboard(db: Session = Depends(get_db)):
    def device_count(status: str) -> int:
        return (
            db.query(func.count(models.Device.id))
            .filter(models.Device.status == status)
            .scalar()
            or 0
        )

    return {
        "devices_total": db.query(func.count(models.Device.id)).scalar() or 0,
        "devices_available": device_count("AVAILABLE"),
        "devices_loaned": device_count("LOANED"),
        "devices_broken": device_count("BROKEN"),
        "devices_lost": device_count("LOST"),
        "devices_retired": device_count("RETIRED"),
        "people_total": db.query(func.count(models.Person.id)).scalar() or 0,
        "people_active": db.query(func.count(models.Person.id)).filter(models.Person.active == 1).scalar() or 0,
        "locations_total": db.query(func.count(models.Location.id)).scalar() or 0,
        "locations_active": db.query(func.count(models.Location.id)).filter(models.Location.active == 1).scalar() or 0,
        "active_loans": db.query(func.count(models.Loan.id)).filter(models.Loan.status == "ACTIVE").scalar() or 0,
        "logs_total": db.query(func.count(models.Log.id)).scalar() or 0,
        "journal_total": db.query(func.count(models.AuditEvent.id)).scalar() or 0,
        "unread_notifications": db.query(func.count(models.Notification.id)).filter(models.Notification.is_read == 0).scalar() or 0,
    }


@router.post("/backup")
def create_backup():
    path = _required_backup("manual")
    return {
        "message": "Database and uploaded photos backed up",
        "path": path,
    }


@router.post("/clear-data")
def clear_all_application_data(
    payload: schemas.AdminClearDataRequest,
    db: Session = Depends(get_db),
):
    expected_code = os.getenv("ADMIN_CLEAR_CODE")
    if not expected_code:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_CLEAR_CODE is not configured in backend/.env",
        )

    if not secrets_match(payload.code, expected_code):
        raise HTTPException(status_code=403, detail="Invalid administrator reset code")

    begin_inventory_write(db)
    # A recovery point is made immediately before the destructive operation.
    backup_path = _required_backup("before_clear")

    deleted = {
        "device_public_links": db.query(models.DevicePublicLink).count(),
        "device_images": db.query(models.DeviceImage).count(),
        "device_location_history": db.query(models.DeviceLocationHistory).count(),
        "loans": db.query(models.Loan).count(),
        "logs": db.query(models.Log).count(),
        "journal": db.query(models.AuditEvent).count(),
        "notifications": db.query(models.Notification).count(),
        "devices": db.query(models.Device).count(),
        "people": db.query(models.Person).count(),
        "locations": db.query(models.Location).count(),
    }

    # Stage photos by renaming on the same volume; restore the original folder
    # if the database transaction fails. The staging path is never public.
    devices_dir = UPLOAD_ROOT / "devices"
    staged_dir = UPLOAD_ROOT / f".reset-{uuid.uuid4().hex}"
    staged = False
    try:
        if devices_dir.exists():
            if devices_dir.is_symlink() or (hasattr(devices_dir, "is_junction") and devices_dir.is_junction()):
                raise OSError("Linked upload directory cannot be reset")
            devices_dir.rename(staged_dir)
            staged = True
    except OSError:
        logger.exception("Inventory photos could not be staged for reset")
        raise HTTPException(status_code=503, detail="Fotografiile nu au putut fi pregătite pentru resetare. Datele au fost păstrate.")

    try:
        # Delete in dependency-safe order. The schema itself remains intact.
        db.query(models.DevicePublicLink).delete(synchronize_session=False)
        db.query(models.DeviceImage).delete(synchronize_session=False)
        db.query(models.DeviceLocationHistory).delete(synchronize_session=False)
        db.query(models.Loan).delete(synchronize_session=False)
        db.query(models.Log).delete(synchronize_session=False)
        db.query(models.AuditEvent).delete(synchronize_session=False)
        db.query(models.Notification).delete(synchronize_session=False)
        db.query(models.Device).delete(synchronize_session=False)
        db.query(models.Person).delete(synchronize_session=False)
        db.query(models.Location).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
        if staged:
            staged_dir.rename(devices_dir)
        raise

    # Remove staged inventory photos only after the transaction succeeds.
    cleanup_pending = False
    if staged:
        try:
            shutil.rmtree(staged_dir)
        except OSError:
            # Database reset succeeded and the verified ZIP holds the photos.
            # Report an incomplete local cleanup instead of silently ignoring it.
            logger.exception("Reset finished but staged photos need local cleanup")
            cleanup_pending = True
    devices_dir.mkdir(parents=True, exist_ok=True)

    return {
        "message": "All application data was cleared",
        "deleted": deleted,
        "backup_path": backup_path,
        "cleanup_pending": cleanup_pending,
    }
