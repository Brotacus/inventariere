from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("/", response_model=list[schemas.LogResponse])
def get_logs(
    action: str | None = Query(None),
    device_id: int | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = db.query(models.Log)

    if action:
        query = query.filter(models.Log.action == action)

    if device_id is not None:
        query = query.filter(models.Log.device_id == device_id)

    return query.order_by(models.Log.id.desc()).limit(limit).all()


@router.get("/actions", response_model=list[str])
def get_log_actions(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Log.action)
        .distinct()
        .order_by(models.Log.action.asc())
        .all()
    )
    return [row[0] for row in rows]
