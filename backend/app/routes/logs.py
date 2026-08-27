from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import get_db

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("/")
def get_logs(db: Session = Depends(get_db)):
    return db.query(models.Log).order_by(models.Log.id.desc()).all()
