import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "inventory.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)


if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=FULL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
)

Base = declarative_base()


def ensure_schema_compatibility():
    """Small SQLite compatibility migration for existing local databases."""
    if not DATABASE_URL.startswith("sqlite"):
        return

    inspector = inspect(engine)
    if "locations" not in inspector.get_table_names():
        return

    # Only initialize roles once; subsequent restarts must preserve explicit edits.
    if "people" in inspector.get_table_names():
        people_columns = {column["name"] for column in inspector.get_columns("people")}
        with engine.begin() as connection:
            if "is_borrower" not in people_columns:
                connection.execute(text("ALTER TABLE people ADD COLUMN is_borrower INTEGER NOT NULL DEFAULT 1"))
            if "is_responsible" not in people_columns:
                connection.execute(text("ALTER TABLE people ADD COLUMN is_responsible INTEGER NOT NULL DEFAULT 0"))
                # Legacy assignments are ambiguous: preserve them for admin review.
                connection.execute(text("UPDATE people SET is_responsible = 1 WHERE id IN (SELECT responsible_person_id FROM devices WHERE responsible_person_id IS NOT NULL)"))

    columns = {column["name"] for column in inspector.get_columns("locations")}
    if "active" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE locations ADD COLUMN active INTEGER NOT NULL DEFAULT 1")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
