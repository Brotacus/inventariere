from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/")
def get_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).all()


@router.post("/")
def create_location(location: schemas.LocationCreate, db: Session = Depends(get_db)):
    db_location = models.Location(**location.model_dump())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location
