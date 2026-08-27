from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.code_generator import generate_device_code

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("/", response_model=list[schemas.DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    return db.query(models.Device).all()


@router.get("/{device_id}", response_model=schemas.DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    return device


@router.post("/", response_model=schemas.DeviceResponse)
def create_device(device: schemas.DeviceCreate, db: Session = Depends(get_db)):
    db_device = models.Device(
        code="TEMP",
        **device.model_dump()
    )

    db.add(db_device)
    db.commit()
    db.refresh(db_device)

    db_device.code = generate_device_code(db_device.id)
    db.commit()
    db.refresh(db_device)

    log = models.Log(
        device_id=db_device.id,
        action="DEVICE_CREATED",
        new_value=db_device.code
    )
    db.add(log)
    db.commit()

    return db_device


@router.put("/{device_id}", response_model=schemas.DeviceResponse)
def update_device(
    device_id: int,
    device_update: schemas.DeviceUpdate,
    db: Session = Depends(get_db)
):
    db_device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = device_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_device, field, value)

    db.commit()
    db.refresh(db_device)

    return db_device


@router.delete("/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    db_device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(db_device)
    db.commit()

    return {"message": "Device deleted"}
