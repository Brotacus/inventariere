from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=list[schemas.NotificationResponse])
def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(models.Notification)
    if unread_only:
        query = query.filter(models.Notification.is_read == 0)
    return query.order_by(models.Notification.id.desc()).limit(limit).all()


@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db)):
    count = db.query(models.Notification).filter(models.Notification.is_read == 0).count()
    return {"count": count}


@router.post("/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    updated = (
        db.query(models.Notification)
        .filter(models.Notification.is_read == 0)
        .update({models.Notification.is_read: 1}, synchronize_session=False)
    )
    db.commit()
    return {"message": "Notifications marked as read", "updated": updated}


@router.post("/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = 1
    db.commit()
    db.refresh(notification)
    return notification
