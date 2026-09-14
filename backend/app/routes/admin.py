from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.backup import create_database_backup

router = APIRouter(prefix="/admin", tags=["Admin"])


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
        "people_active": (
            db.query(func.count(models.Person.id))
            .filter(models.Person.active == 1)
            .scalar()
            or 0
        ),
        "locations_total": db.query(func.count(models.Location.id)).scalar() or 0,
        "locations_active": (
            db.query(func.count(models.Location.id))
            .filter(models.Location.active == 1)
            .scalar()
            or 0
        ),
        "active_loans": (
            db.query(func.count(models.Loan.id))
            .filter(models.Loan.status == "ACTIVE")
            .scalar()
            or 0
        ),
        "logs_total": db.query(func.count(models.Log.id)).scalar() or 0,
    }


@router.post("/backup")
def create_backup():
    path = create_database_backup("manual")
    return {
        "message": "Backup created" if path else "Backup is only available for SQLite",
        "path": path,
    }
