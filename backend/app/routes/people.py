import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/people", tags=["People"])


def person_snapshot(person: models.Person) -> str:
    return json.dumps(
        {
            "id": person.id,
            "name": person.name,
            "email": person.email,
            "phone": person.phone,
            "active": bool(person.active),
        },
        ensure_ascii=False,
    )


@router.get("/", response_model=list[schemas.PersonResponse])
def get_people(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
):
    query = db.query(models.Person)

    if not include_inactive:
        query = query.filter(models.Person.active == 1)

    return query.order_by(models.Person.name.asc()).all()


@router.get("/{person_id}", response_model=schemas.PersonResponse)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(models.Person).filter(models.Person.id == person_id).first()

    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    return person


@router.post("/", response_model=schemas.PersonResponse, status_code=201)
def create_person(person: schemas.PersonCreate, db: Session = Depends(get_db)):
    if not person.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    db_person = models.Person(
        name=person.name.strip(),
        email=person.email.strip() if person.email else None,
        phone=person.phone.strip() if person.phone else None,
        active=1,
    )

    db.add(db_person)
    db.flush()

    db.add(
        models.Log(
            action="PERSON_CREATED",
            new_value=person_snapshot(db_person),
        )
    )

    db.commit()
    db.refresh(db_person)
    return db_person


@router.put("/{person_id}", response_model=schemas.PersonResponse)
def update_person(
    person_id: int,
    person_update: schemas.PersonUpdate,
    db: Session = Depends(get_db),
):
    db_person = db.query(models.Person).filter(models.Person.id == person_id).first()

    if db_person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    update_data = person_update.model_dump(exclude_unset=True)

    if "name" in update_data:
        if update_data["name"] is None or not update_data["name"].strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update_data["name"] = update_data["name"].strip()

    if "email" in update_data and update_data["email"]:
        update_data["email"] = update_data["email"].strip()

    if "phone" in update_data and update_data["phone"]:
        update_data["phone"] = update_data["phone"].strip()

    if update_data.get("active") is False:
        active_loan = (
            db.query(models.Loan)
            .filter(
                models.Loan.person_id == person_id,
                models.Loan.status == "ACTIVE",
            )
            .first()
        )
        if active_loan:
            raise HTTPException(
                status_code=409,
                detail="Person has an active loan and cannot be deactivated",
            )

    old_value = person_snapshot(db_person)

    for field, value in update_data.items():
        if field == "active" and value is not None:
            value = 1 if value else 0
        setattr(db_person, field, value)

    db.flush()

    db.add(
        models.Log(
            action="PERSON_UPDATED",
            old_value=old_value,
            new_value=person_snapshot(db_person),
        )
    )

    db.commit()
    db.refresh(db_person)
    return db_person


@router.delete("/{person_id}")
def deactivate_person(person_id: int, db: Session = Depends(get_db)):
    db_person = db.query(models.Person).filter(models.Person.id == person_id).first()

    if db_person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    active_loan = (
        db.query(models.Loan)
        .filter(
            models.Loan.person_id == person_id,
            models.Loan.status == "ACTIVE",
        )
        .first()
    )

    if active_loan:
        raise HTTPException(
            status_code=409,
            detail="Person has an active loan and cannot be deactivated",
        )

    if not db_person.active:
        return {"message": "Person is already inactive"}

    old_value = person_snapshot(db_person)
    db_person.active = 0
    db.flush()

    db.add(
        models.Log(
            action="PERSON_DEACTIVATED",
            old_value=old_value,
            new_value=person_snapshot(db_person),
        )
    )

    db.commit()
    return {"message": "Person deactivated"}
