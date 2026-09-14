import json
from typing import Any

from sqlalchemy.orm import Session

from app import models


def record_activity(
    db: Session,
    *,
    event_type: str,
    title: str,
    description: str,
    category: str = "SYSTEM",
    severity: str = "INFO",
    entity_type: str | None = None,
    entity_id: int | None = None,
    device_id: int | None = None,
    loan_id: int | None = None,
    person_id: int | None = None,
    location_id: int | None = None,
    details: dict[str, Any] | None = None,
    notify: bool = False,
) -> models.AuditEvent:
    """Add a detailed journal entry and, optionally, an in-app notification.

    The caller owns the transaction. This function intentionally does not commit,
    so the journal entry is persisted atomically with the business operation.
    """
    event = models.AuditEvent(
        event_type=event_type,
        category=category,
        severity=severity,
        entity_type=entity_type,
        entity_id=entity_id,
        device_id=device_id,
        loan_id=loan_id,
        person_id=person_id,
        location_id=location_id,
        title=title,
        description=description,
        details_json=json.dumps(details, ensure_ascii=False) if details else None,
    )
    db.add(event)

    if notify:
        db.add(
            models.Notification(
                event_type=event_type,
                severity=severity,
                title=title,
                message=description,
                device_id=device_id,
                loan_id=loan_id,
                is_read=0,
            )
        )

    return event
