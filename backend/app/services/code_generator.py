from sqlalchemy import case, func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models


def generate_device_code(device_id: int) -> str:
    return f"DEV-{device_id:05d}"


def reserve_entity_id(db: Session, model, name: str, history_column) -> int:
    """Allocate an identity atomically without reusing retained journal IDs.

    Existing databases are initialized from their current and historical rows.
    The counter update belongs to the caller's transaction; SQLite and other
    transactional databases serialize concurrent updates to this one row.
    """
    current_max = db.query(func.max(model.id)).scalar() or 0
    historical_max = db.query(func.max(history_column)).scalar() or 0
    high_water = max(current_max, historical_max)
    if db.get(models.InventoryCounter, name) is None:
        try:
            with db.begin_nested():
                db.add(models.InventoryCounter(name=name, last_id=high_water))
                db.flush()
        except IntegrityError:
            # A concurrent request may have initialized the same counter.
            pass
    next_id = db.execute(
        update(models.InventoryCounter)
        .where(models.InventoryCounter.name == name)
        .values(last_id=case(
            (models.InventoryCounter.last_id < high_water, high_water + 1),
            else_=models.InventoryCounter.last_id + 1,
        ))
        .returning(models.InventoryCounter.last_id)
    ).scalar_one()
    return next_id
