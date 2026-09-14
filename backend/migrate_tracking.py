"""One-time helper for inventories created before location tracking existed.

Run from backend/ with:
    python migrate_tracking.py

It creates the new tables if needed and gives every existing device that already
has a location one initial snapshot in device_location_history.
"""

from app import models
from app.database import Base, SessionLocal, engine


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    created = 0
    missing_location = 0

    try:
        devices = db.query(models.Device).order_by(models.Device.id.asc()).all()
        for device in devices:
            already_tracked = (
                db.query(models.DeviceLocationHistory)
                .filter(models.DeviceLocationHistory.device_id == device.id)
                .first()
            )
            if already_tracked:
                continue

            if device.location_id is None:
                missing_location += 1
                continue

            location = (
                db.query(models.Location)
                .filter(models.Location.id == device.location_id)
                .first()
            )
            if location is None:
                missing_location += 1
                continue

            db.add(
                models.DeviceLocationHistory(
                    device_id=device.id,
                    from_location_id=None,
                    from_location_name=None,
                    to_location_id=location.id,
                    to_location_name=location.name,
                    change_type="LEGACY_SNAPSHOT",
                )
            )
            created += 1

        db.commit()
    finally:
        db.close()

    print(f"Tracking snapshots created: {created}")
    if missing_location:
        print(f"Devices still needing a location: {missing_location}")
        print("Open those devices in Inventory and assign a location from the tracking page.")


if __name__ == "__main__":
    main()
