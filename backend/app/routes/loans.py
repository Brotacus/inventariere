import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/loans", tags=["Loans"])


def loan_to_response(loan: models.Loan, db: Session) -> dict:
    device = db.query(models.Device).filter(models.Device.id == loan.device_id).first()
    person = db.query(models.Person).filter(models.Person.id == loan.person_id).first()

    return {
        "id": loan.id,
        "device_id": loan.device_id,
        "device_code": device.code if device else None,
        "device_name": device.name if device else None,
        "person_id": loan.person_id,
        "person_name": person.name if person else None,
        "loan_date": loan.loan_date,
        "return_date": loan.return_date,
        "status": loan.status,
    }


@router.get("/", response_model=list[schemas.LoanResponse])
def get_loans(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Loan)

    if status:
        query = query.filter(models.Loan.status == status.upper())

    loans = query.order_by(models.Loan.id.desc()).all()
    return [loan_to_response(loan, db) for loan in loans]


@router.get("/{loan_id}", response_model=schemas.LoanResponse)
def get_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()

    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")

    return loan_to_response(loan, db)


@router.post("/", response_model=schemas.LoanResponse, status_code=201)
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == loan.device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    person = db.query(models.Person).filter(models.Person.id == loan.person_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    if not person.active:
        raise HTTPException(status_code=409, detail="Person is inactive")

    active_loan = (
        db.query(models.Loan)
        .filter(
            models.Loan.device_id == loan.device_id,
            models.Loan.status == "ACTIVE",
        )
        .first()
    )

    if active_loan or device.status == "LOANED":
        raise HTTPException(status_code=409, detail="Device is already loaned")

    if device.status != "AVAILABLE":
        raise HTTPException(
            status_code=409,
            detail=f"Device must be AVAILABLE before loaning it. Current status: {device.status}",
        )

    db_loan = models.Loan(
        device_id=loan.device_id,
        person_id=loan.person_id,
        status="ACTIVE",
    )
    db.add(db_loan)

    device.status = "LOANED"
    device.responsible_person_id = person.id

    db.flush()

    db.add(
        models.Log(
            device_id=device.id,
            action="LOAN_CREATED",
            old_value=json.dumps({"status": "AVAILABLE"}),
            new_value=json.dumps(
                {
                    "loan_id": db_loan.id,
                    "person_id": person.id,
                    "person_name": person.name,
                    "status": "LOANED",
                },
                ensure_ascii=False,
            ),
        )
    )

    db.commit()
    db.refresh(db_loan)
    return loan_to_response(db_loan, db)


@router.post("/{loan_id}/return", response_model=schemas.LoanResponse)
def return_loan(loan_id: int, db: Session = Depends(get_db)):
    db_loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()

    if db_loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")

    if db_loan.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Loan is already returned")

    device = db.query(models.Device).filter(models.Device.id == db_loan.device_id).first()

    db_loan.status = "RETURNED"
    db_loan.return_date = datetime.now(timezone.utc)

    if device:
        device.status = "AVAILABLE"
        device.responsible_person_id = None

    db.flush()

    db.add(
        models.Log(
            device_id=db_loan.device_id if device else None,
            action="LOAN_RETURNED",
            old_value=json.dumps({"loan_id": db_loan.id, "status": "LOANED"}),
            new_value=json.dumps({"loan_id": db_loan.id, "status": "AVAILABLE"}),
        )
    )

    db.commit()
    db.refresh(db_loan)
    return loan_to_response(db_loan, db)
