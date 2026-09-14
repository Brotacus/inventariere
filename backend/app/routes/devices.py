import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.code_generator import generate_device_code

router = APIRouter(prefix="/devices", tags=["Devices"])

VALID_STATUSES = {"AVAILABLE", "LOANED", "IN_USE", "BROKEN", "LOST", "RETIRED"}


def device_snapshot(device: models.Device) -> str:
    return json.dumps(
        {
            "id": device.id,
            "code": device.code,
            "name": device.name,
            "category": device.category,
            "serial_number": device.serial_number,
            "status": device.status,
            "location_id": device.location_id,
            "responsible_person_id": device.responsible_person_id,
            "description": device.description,
        },
        ensure_ascii=False,
    )


def validate_references(
    db: Session,
    location_id: int | None,
    responsible_person_id: int | None,
):
    if location_id is not None:
        location = db.query(models.Location).filter(models.Location.id == location_id).first()
        if location is None:
            raise HTTPException(status_code=404, detail="Location not found")

    if responsible_person_id is not None:
        person = (
            db.query(models.Person)
            .filter(models.Person.id == responsible_person_id)
            .first()
        )
        if person is None:
            raise HTTPException(status_code=404, detail="Responsible person not found")
        if not person.active:
            raise HTTPException(status_code=409, detail="Responsible person is inactive")


def validate_status(status: str):
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid device status. Allowed: {', '.join(sorted(VALID_STATUSES))}",
        )


@router.get("/", response_model=list[schemas.DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    return db.query(models.Device).order_by(models.Device.id.desc()).all()


@router.get("/{device_id}", response_model=schemas.DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    return device


@router.post("/", response_model=schemas.DeviceResponse, status_code=201)
def create_device(device: schemas.DeviceCreate, db: Session = Depends(get_db)):
    status = device.status.upper()
    validate_status(status)

    if status == "LOANED":
        raise HTTPException(
            status_code=409,
            detail="Use the Loans section to mark a device as loaned",
        )

    validate_references(db, device.location_id, device.responsible_person_id)

    if not device.name.strip() or not device.category.strip():
        raise HTTPException(status_code=400, detail="Name and category are required")

    db_device = models.Device(
        code="TEMP",
        name=device.name.strip(),
        category=device.category.strip(),
        serial_number=device.serial_number.strip() if device.serial_number else None,
        status=status,
        location_id=device.location_id,
        responsible_person_id=device.responsible_person_id,
        description=device.description.strip() if device.description else None,
    )

    db.add(db_device)
    db.flush()

    db_device.code = generate_device_code(db_device.id)
    db.flush()

    db.add(
        models.Log(
            device_id=db_device.id,
            action="DEVICE_CREATED",
            new_value=device_snapshot(db_device),
        )
    )

    db.commit()
    db.refresh(db_device)
    return db_device


@router.put("/{device_id}", response_model=schemas.DeviceResponse)
def update_device(
    device_id: int,
    device_update: schemas.DeviceUpdate,
    db: Session = Depends(get_db),
):
    db_device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = device_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].upper()
        validate_status(update_data["status"])

    active_loan = (
        db.query(models.Loan)
        .filter(
            models.Loan.device_id == device_id,
            models.Loan.status == "ACTIVE",
        )
        .first()
    )

    if active_loan:
        if "status" in update_data and update_data["status"] != "LOANED":
            raise HTTPException(
                status_code=409,
                detail="Device has an active loan. Return it from the Loans section first",
            )
        if (
            "responsible_person_id" in update_data
            and update_data["responsible_person_id"] != active_loan.person_id
        ):
            raise HTTPException(
                status_code=409,
                detail="Responsible person is controlled by the active loan",
            )
    elif update_data.get("status") == "LOANED":
        raise HTTPException(
            status_code=409,
            detail="Use the Loans section to mark a device as loaned",
        )

    location_id = update_data.get("location_id", db_device.location_id)
    responsible_person_id = update_data.get(
        "responsible_person_id",
        db_device.responsible_person_id,
    )
    validate_references(db, location_id, responsible_person_id)

    if "name" in update_data:
        if update_data["name"] is None or not update_data["name"].strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update_data["name"] = update_data["name"].strip()

    if "category" in update_data:
        if update_data["category"] is None or not update_data["category"].strip():
            raise HTTPException(status_code=400, detail="Category cannot be empty")
        update_data["category"] = update_data["category"].strip()

    if "serial_number" in update_data and update_data["serial_number"]:
        update_data["serial_number"] = update_data["serial_number"].strip()

    if "description" in update_data and update_data["description"]:
        update_data["description"] = update_data["description"].strip()

    old_value = device_snapshot(db_device)

    for field, value in update_data.items():
        setattr(db_device, field, value)

    db.flush()

    db.add(
        models.Log(
            device_id=db_device.id,
            action="DEVICE_UPDATED",
            old_value=old_value,
            new_value=device_snapshot(db_device),
        )
    )

    db.commit()
    db.refresh(db_device)
    return db_device


@router.delete("/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    db_device = db.query(models.Device).filter(models.Device.id == device_id).first()

    if db_device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    loan_history = (
        db.query(models.Loan)
        .filter(models.Loan.device_id == device_id)
        .first()
    )

    if loan_history:
        raise HTTPException(
            status_code=409,
            detail="Device has loan history and cannot be deleted. Mark it RETIRED instead",
        )

    old_value = device_snapshot(db_device)

    # Keep the audit entry even after the device is removed.
    # device_id stays NULL so a strict FK database (e.g. PostgreSQL) can delete safely.
    db.add(
        models.Log(
            device_id=None,
            action="DEVICE_DELETED",
            old_value=old_value,
        )
    )
    db.delete(db_device)
    db.commit()

    return {"message": "Device deleted"}
