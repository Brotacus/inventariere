import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import begin_inventory_write, get_db
from app.services.audit import record_activity
from app.services.email_service import send_loan_email
from app.services.code_generator import reserve_entity_id

router = APIRouter(prefix="/loans", tags=["Loans"])


def loan_to_response(loan: models.Loan, db: Session | None = None, *, device=None, person=None) -> dict:
    if db is not None:
        device = db.get(models.Device, loan.device_id)
        person = db.get(models.Person, loan.person_id)
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


def location_for_device(device: models.Device, db: Session) -> models.Location | None:
    if device.location_id is None:
        return None
    return db.query(models.Location).filter(models.Location.id == device.location_id).first()


@router.get("/", response_model=list[schemas.LoanResponse])
def get_loans(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Loan, models.Device, models.Person)
        .outerjoin(models.Device, models.Loan.device_id == models.Device.id)
        .outerjoin(models.Person, models.Loan.person_id == models.Person.id)
    )
    if status:
        query = query.filter(models.Loan.status == status.upper())
    loans = query.order_by(models.Loan.id.desc()).all()
    return [loan_to_response(loan, device=device, person=person) for loan, device, person in loans]


@router.get("/{loan_id}", response_model=schemas.LoanResponse)
def get_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan_to_response(loan, db)


@router.post("/", response_model=schemas.LoanResponse, status_code=201)
def create_loan(loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    begin_inventory_write(db)
    device = db.query(models.Device).filter(models.Device.id == loan.device_id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    person = db.query(models.Person).filter(models.Person.id == loan.person_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    if not person.is_borrower:
        raise HTTPException(status_code=409, detail="Persoana nu are rol de împrumutător.")
    if not person.active:
        raise HTTPException(status_code=409, detail="Person is inactive")

    active_loan = (
        db.query(models.Loan)
        .filter(models.Loan.device_id == loan.device_id, models.Loan.status == "ACTIVE")
        .first()
    )
    if active_loan or device.status == "LOANED":
        raise HTTPException(status_code=409, detail="Device is already loaned")
    if device.status != "AVAILABLE":
        raise HTTPException(
            status_code=409,
            detail=f"Device must be AVAILABLE before loaning it. Current status: {device.status}",
        )

    location = location_for_device(device, db)
    claimed = db.query(models.Device).filter(
        models.Device.id == loan.device_id,
        models.Device.status == "AVAILABLE",
    ).update({models.Device.status: "LOANED"}, synchronize_session=False)
    if not claimed:
        db.rollback()
        raise HTTPException(status_code=409, detail="Device is no longer available for loaning")
    db_loan = models.Loan(
        id=reserve_entity_id(db, models.Loan, "loan", models.AuditEvent.loan_id),
        device_id=loan.device_id, person_id=loan.person_id, status="ACTIVE",
    )
    db.add(db_loan)
    device.status = "LOANED"
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
                    "location_id": location.id if location else None,
                    "location_name": location.name if location else None,
                },
                ensure_ascii=False,
            ),
        )
    )

    record_activity(
        db,
        event_type="LOAN_CREATED",
        category="LOAN",
        severity="INFO",
        title="Împrumut nou",
        description=(
            f"{device.code} · {device.name} a fost împrumutat către {person.name}"
            + (f" din locația {location.name}." if location else ".")
        ),
        entity_type="loan",
        entity_id=db_loan.id,
        device_id=device.id,
        loan_id=db_loan.id,
        person_id=person.id,
        location_id=location.id if location else None,
        details={
            "device_code": device.code,
            "device_name": device.name,
            "person_name": person.name,
            "person_email": person.email,
            "location_name": location.name if location else None,
            "from_status": "AVAILABLE",
            "to_status": "LOANED",
        },
        notify=True,
    )

    db.commit()
    db.refresh(db_loan)

    if person.email:
        try:
            send_loan_email(
                recipient_email=person.email,
                person_name=person.name,
                device_name=device.name,
                device_code=device.code,
                loan_id=db_loan.id,
            )
            db.add(
                models.Log(
                    device_id=device.id,
                    action="LOAN_EMAIL_SENT",
                    new_value=json.dumps({"loan_id": db_loan.id, "person_id": person.id}),
                )
            )
            record_activity(
                db,
                event_type="LOAN_EMAIL_SENT",
                category="COMMUNICATION",
                severity="INFO",
                title="Confirmare trimisă",
                description=f"Emailul de confirmare pentru împrumutul #{db_loan.id} a fost trimis către {person.email}.",
                entity_type="loan",
                entity_id=db_loan.id,
                device_id=device.id,
                loan_id=db_loan.id,
                person_id=person.id,
                details={"recipient": person.email},
                notify=False,
            )
        except Exception as exc:
            db.add(
                models.Log(
                    device_id=device.id,
                    action="LOAN_EMAIL_FAILED",
                    new_value=json.dumps(
                        {"loan_id": db_loan.id, "person_id": person.id, "error": str(exc)[:500]},
                        ensure_ascii=False,
                    ),
                )
            )
            record_activity(
                db,
                event_type="LOAN_EMAIL_FAILED",
                category="COMMUNICATION",
                severity="WARNING",
                title="Emailul nu a putut fi trimis",
                description=f"Împrumutul #{db_loan.id} este salvat, dar notificarea email către {person.email} a eșuat.",
                entity_type="loan",
                entity_id=db_loan.id,
                device_id=device.id,
                loan_id=db_loan.id,
                person_id=person.id,
                details={"recipient": person.email, "error": str(exc)[:500]},
                notify=True,
            )
    else:
        db.add(
            models.Log(
                device_id=device.id,
                action="LOAN_EMAIL_SKIPPED",
                new_value=json.dumps(
                    {"loan_id": db_loan.id, "person_id": person.id, "reason": "Person has no email address"}
                ),
            )
        )
        record_activity(
            db,
            event_type="LOAN_EMAIL_SKIPPED",
            category="COMMUNICATION",
            severity="WARNING",
            title="Persoana nu are email",
            description=f"Împrumutul #{db_loan.id} a fost creat, dar {person.name} nu are adresă de email înregistrată.",
            entity_type="loan",
            entity_id=db_loan.id,
            device_id=device.id,
            loan_id=db_loan.id,
            person_id=person.id,
            notify=True,
        )

    db.commit()
    return loan_to_response(db_loan, db)


@router.post("/{loan_id}/return", response_model=schemas.LoanResponse)
def return_loan(loan_id: int, db: Session = Depends(get_db)):
    begin_inventory_write(db)
    db_loan = db.query(models.Loan).filter(models.Loan.id == loan_id).first()
    if db_loan is None:
        raise HTTPException(status_code=404, detail="Loan not found")
    if db_loan.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Loan is already returned")

    device = db.query(models.Device).filter(models.Device.id == db_loan.device_id).first()
    person = db.query(models.Person).filter(models.Person.id == db_loan.person_id).first()
    location = location_for_device(device, db) if device else None

    returned_at = datetime.now(timezone.utc)
    returned = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.status == "ACTIVE",
    ).update({models.Loan.status: "RETURNED", models.Loan.return_date: returned_at}, synchronize_session=False)
    if not returned:
        db.rollback()
        raise HTTPException(status_code=409, detail="Loan is already returned")
    db_loan.status = "RETURNED"
    db_loan.return_date = returned_at
    if device:
        device.status = "AVAILABLE"

    db.flush()
    db.add(
        models.Log(
            device_id=db_loan.device_id if device else None,
            action="LOAN_RETURNED",
            old_value=json.dumps({"loan_id": db_loan.id, "status": "LOANED"}),
            new_value=json.dumps(
                {
                    "loan_id": db_loan.id,
                    "status": "AVAILABLE",
                    "location_id": location.id if location else None,
                    "location_name": location.name if location else None,
                },
                ensure_ascii=False,
            ),
        )
    )

    device_label = f"{device.code} · {device.name}" if device else f"Device #{db_loan.device_id}"
    person_label = person.name if person else f"Persoana #{db_loan.person_id}"
    record_activity(
        db,
        event_type="LOAN_RETURNED",
        category="LOAN",
        severity="INFO",
        title="Obiect returnat",
        description=(
            f"{device_label} a fost returnat de {person_label}"
            + (f" în locația {location.name}." if location else ".")
        ),
        entity_type="loan",
        entity_id=db_loan.id,
        device_id=db_loan.device_id,
        loan_id=db_loan.id,
        person_id=db_loan.person_id,
        location_id=location.id if location else None,
        details={
            "device_code": device.code if device else None,
            "device_name": device.name if device else None,
            "person_name": person.name if person else None,
            "location_name": location.name if location else None,
            "from_status": "LOANED",
            "to_status": "AVAILABLE",
            "loan_date": db_loan.loan_date.isoformat() if db_loan.loan_date else None,
            "return_date": db_loan.return_date.isoformat() if db_loan.return_date else None,
        },
        notify=True,
    )

    db.commit()
    db.refresh(db_loan)
    return loan_to_response(db_loan, db)
