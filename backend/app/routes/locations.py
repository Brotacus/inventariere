import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/locations", tags=["Locations"])


def location_snapshot(location: models.Location) -> str:
    return json.dumps(
        {
            "id": location.id,
            "name": location.name,
            "description": location.description,
            "active": bool(location.active),
        },
        ensure_ascii=False,
    )


def location_name_exists(db: Session, name: str, exclude_id: int | None = None) -> bool:
    query = db.query(models.Location).filter(models.Location.name == name)
    if exclude_id is not None:
        query = query.filter(models.Location.id != exclude_id)
    return query.first() is not None


@router.get("/", response_model=list[schemas.LocationResponse])
def get_locations(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
):
    query = db.query(models.Location)
    if not include_inactive:
        query = query.filter(models.Location.active == 1)
    return query.order_by(models.Location.name.asc()).all()


@router.get("/{location_id}", response_model=schemas.LocationResponse)
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("/", response_model=schemas.LocationResponse, status_code=201)
def create_location(location: schemas.LocationCreate, db: Session = Depends(get_db)):
    name = location.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Location name cannot be empty")
    if location_name_exists(db, name):
        raise HTTPException(status_code=409, detail="Location name already exists")

    db_location = models.Location(
        name=name,
        description=location.description.strip() if location.description else None,
        active=1,
    )
    db.add(db_location)
    db.flush()
    db.add(models.Log(action="LOCATION_CREATED", new_value=location_snapshot(db_location)))
    db.commit()
    db.refresh(db_location)
    return db_location


@router.put("/{location_id}", response_model=schemas.LocationResponse)
def update_location(
    location_id: int,
    location_update: schemas.LocationUpdate,
    db: Session = Depends(get_db),
):
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")

    update_data = location_update.model_dump(exclude_unset=True)
    if "name" in update_data:
        if update_data["name"] is None or not update_data["name"].strip():
            raise HTTPException(status_code=400, detail="Location name cannot be empty")
        update_data["name"] = update_data["name"].strip()
        if location_name_exists(db, update_data["name"], exclude_id=location_id):
            raise HTTPException(status_code=409, detail="Location name already exists")

    if "description" in update_data and update_data["description"]:
        update_data["description"] = update_data["description"].strip()

    if "active" in update_data and update_data["active"] is not None:
        update_data["active"] = 1 if update_data["active"] else 0

    if update_data.get("active") == 0:
        device = db.query(models.Device).filter(models.Device.location_id == location_id).first()
        if device:
            raise HTTPException(
                status_code=409,
                detail="Location is used by one or more devices and cannot be archived",
            )

    old_value = location_snapshot(db_location)
    for field, value in update_data.items():
        setattr(db_location, field, value)

    db.flush()
    db.add(
        models.Log(
            action="LOCATION_UPDATED",
            old_value=old_value,
            new_value=location_snapshot(db_location),
        )
    )
    db.commit()
    db.refresh(db_location)
    return db_location


@router.delete("/{location_id}")
def archive_location(location_id: int, db: Session = Depends(get_db)):
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")

    device = db.query(models.Device).filter(models.Device.location_id == location_id).first()
    if device:
        raise HTTPException(
            status_code=409,
            detail="Location is used by one or more devices and cannot be archived",
        )

    if not db_location.active:
        return {"message": "Location is already archived"}

    old_value = location_snapshot(db_location)
    db_location.active = 0
    db.flush()
    db.add(
        models.Log(
            action="LOCATION_ARCHIVED",
            old_value=old_value,
            new_value=location_snapshot(db_location),
        )
    )
    db.commit()
    return {"message": "Location archived"}
