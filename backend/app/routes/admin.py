import hmac
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.backup import create_database_backup

router = APIRouter(prefix="/admin", tags=["Admin"])

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_ROOT = BACKEND_DIR / "uploads"


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
    path = create_database_backup("manual")
    return {
        "message": "Backup created" if path else "Backup is only available for SQLite",
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

    if not hmac.compare_digest(payload.code, expected_code):
        raise HTTPException(status_code=403, detail="Invalid administrator reset code")

    # A recovery point is made immediately before the destructive operation.
    backup_path = create_database_backup("before_clear")

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
        raise

    # Uploaded images are application data too. Keep the uploads root itself so
    # FastAPI's StaticFiles mount stays valid after the reset.
    if UPLOAD_ROOT.exists():
        for child in UPLOAD_ROOT.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    return {
        "message": "All application data was cleared",
        "deleted": deleted,
        "backup_path": backup_path,
    }
