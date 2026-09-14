from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/public/assets", tags=["Public Assets"])


def image_url(image: models.DeviceImage | None) -> str | None:
    if image is None:
        return None
    return f"/uploads/devices/{image.device_id}/{image.stored_name}"


@router.get("/{token}", response_model=schemas.PublicDeviceResponse)
def get_public_device(token: str, db: Session = Depends(get_db)):
    link = (
        db.query(models.DevicePublicLink)
        .filter(
            models.DevicePublicLink.token == token,
            models.DevicePublicLink.is_active == 1,
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Această etichetă nu este activă sau linkul nu mai este valid.")

    device = db.query(models.Device).filter(models.Device.id == link.device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Obiectul nu mai există în inventar.")

    location = None
    if device.location_id is not None:
        location = db.query(models.Location).filter(models.Location.id == device.location_id).first()

    cover = (
        db.query(models.DeviceImage)
        .filter(models.DeviceImage.device_id == device.id)
        .order_by(models.DeviceImage.id.asc())
        .first()
    )
    image_count = (
        db.query(models.DeviceImage)
        .filter(models.DeviceImage.device_id == device.id)
        .count()
    )

    return {
        "code": device.code,
        "name": device.name,
        "category": device.category,
        "serial_number": device.serial_number,
        "status": device.status,
        "description": device.description,
        "location_name": location.name if location else None,
        "location_description": location.description if location else None,
        "image_url": image_url(cover),
        "image_count": image_count,
        "created_at": device.created_at,
        "updated_at": device.updated_at,
    }
