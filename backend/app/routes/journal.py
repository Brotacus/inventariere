from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/journal", tags=["Journal"])


@router.get("/", response_model=list[schemas.AuditEventResponse])
def get_journal(
    event_type: str | None = Query(None),
    category: str | None = Query(None),
    severity: str | None = Query(None),
    device_id: int | None = Query(None),
    loan_id: int | None = Query(None),
    limit: int = Query(300, ge=1, le=1500),
    db: Session = Depends(get_db),
):
    query = db.query(models.AuditEvent)

    if event_type:
        query = query.filter(models.AuditEvent.event_type == event_type)
    if category:
        query = query.filter(models.AuditEvent.category == category.upper())
    if severity:
        query = query.filter(models.AuditEvent.severity == severity.upper())
    if device_id is not None:
        query = query.filter(models.AuditEvent.device_id == device_id)
    if loan_id is not None:
        query = query.filter(models.AuditEvent.loan_id == loan_id)

    return query.order_by(models.AuditEvent.id.desc()).limit(limit).all()


@router.get("/event-types", response_model=list[str])
def get_event_types(db: Session = Depends(get_db)):
    rows = (
        db.query(models.AuditEvent.event_type)
        .distinct()
        .order_by(models.AuditEvent.event_type.asc())
        .all()
    )
    return [row[0] for row in rows]
