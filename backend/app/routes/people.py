from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/people", tags=["People"])


@router.get("/")
def get_people(db: Session = Depends(get_db)):
    return db.query(models.Person).all()


@router.post("/")
def create_person(person: schemas.PersonCreate, db: Session = Depends(get_db)):
    db_person = models.Person(**person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return db_person
