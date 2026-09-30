from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/public/assets", tags=["Public Assets"])


def image_url(image: models.DeviceImage | None) -> str | None:
    if image is None:
        return None
    return f"/uploads/devices/{image.device_id}/{image.stored_name}"


def public_payload(device, location, cover, image_count):
    # Explicit allowlist shared by QR pages and the catalog. Never serialize the
    # device model directly: assignments and internal tracking remain private.
    return {
        "code": device.code, "name": device.name, "category": device.category,
        "serial_number": device.serial_number, "status": device.status,
        "description": device.description,
        "location_name": location.name if location else None,
        "location_description": location.description if location else None,
        "image_url": image_url(cover), "image_count": image_count,
        "created_at": device.created_at, "updated_at": device.updated_at,
    }


def device_payload(device, db):
    location = db.get(models.Location, device.location_id) if device.location_id else None
    images = db.query(models.DeviceImage).filter(models.DeviceImage.device_id == device.id)
    return public_payload(device, location, images.order_by(models.DeviceImage.id).first(), images.count())


@router.get("/catalog", response_model=schemas.PublicCatalogResponse)
def get_catalog(
    q: str = Query("", max_length=200),
    category: str = Query("", max_length=200),
    status: str = Query("", max_length=30),
    location: str = Query("", max_length=200),
    sort: str = Query("newest", pattern="^(newest|name|code)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(models.Device).outerjoin(models.Location, models.Device.location_id == models.Location.id)
    total = query.count()
    if q.strip():
        # Treat wildcard characters as literal user input.
        term = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.filter(or_(*(column.ilike(term, escape="\\") for column in (
            models.Device.name, models.Device.code, models.Device.serial_number,
        ))))
    if category:
        query = query.filter(models.Device.category == category)
    if status:
        query = query.filter(models.Device.status == status)
    if location:
        query = query.filter(models.Location.name == location)
    filtered = query.count()
    page = min(page, max(1, (filtered + page_size - 1) // page_size))
    ordering = {"newest": models.Device.id.desc(), "name": func.lower(models.Device.name), "code": models.Device.code}
    rows = query.order_by(ordering[sort], models.Device.id).offset((page - 1) * page_size).limit(page_size).all()
    ids = [device.id for device in rows]
    locations = {item.id: item for item in db.query(models.Location).filter(models.Location.id.in_([d.location_id for d in rows if d.location_id])).all()}
    image_stats = db.query(models.DeviceImage.device_id, func.min(models.DeviceImage.id), func.count(models.DeviceImage.id)).filter(models.DeviceImage.device_id.in_(ids)).group_by(models.DeviceImage.device_id).all()
    covers = {img.id: img for img in db.query(models.DeviceImage).filter(models.DeviceImage.id.in_([row[1] for row in image_stats])).all()}
    images = {device_id: (covers[cover_id], count) for device_id, cover_id, count in image_stats}
    return {
        "items": [public_payload(d, locations.get(d.location_id), *images.get(d.id, (None, 0))) for d in rows],
        "total": total, "filtered_total": filtered, "page": page, "page_size": page_size,
        "categories": [row[0] for row in db.query(models.Device.category).distinct().order_by(models.Device.category).all()],
        "locations": [row[0] for row in db.query(models.Location.name).join(models.Device, models.Device.location_id == models.Location.id).distinct().order_by(models.Location.name).all()],
        "statuses": [row[0] for row in db.query(models.Device.status).distinct().order_by(models.Device.status).all()],
    }


@router.get("/catalog/{code}", response_model=schemas.PublicDeviceResponse)
def get_catalog_device(code: str, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.code == code).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Obiectul nu mai există în inventar.")
    return device_payload(device, db)


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

    return device_payload(device, db)
