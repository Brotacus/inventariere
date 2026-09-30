import os
from pathlib import Path
import tempfile
import shutil

import pytest

_test_dir = tempfile.TemporaryDirectory(prefix="inventory-tests-")
_test_root = Path(_test_dir.name).resolve()
os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(_test_dir.name) / "test.db")
os.environ["ADMIN_PASSWORD"] = "test-only-password"
os.environ["UPLOAD_DIR"] = str(_test_root / "uploads")
os.environ["BACKUP_DIR"] = str(_test_root / "backups")
os.environ["ENABLE_API_DOCS"] = "false"
os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
os.environ["CORS_ALLOW_LAN"] = "true"

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app.routes import auth
from app.services import auth_service


@pytest.fixture(scope="session", autouse=True)
def close_database():
    yield
    engine.dispose()
    _test_dir.cleanup()


@pytest.fixture
def client():
    auth._FAILED_ATTEMPTS.clear()
    auth_service._SESSIONS.clear()
    for name in ("uploads", "backups"):
        target = (_test_root / name).resolve()
        assert target.parent == _test_root and "inventory-tests-" in str(_test_root)
        if target.exists():
            shutil.rmtree(target)
        target.mkdir()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        response = client.post("/auth/login", json={"password": "test-only-password"})
        assert response.status_code == 200
        client.headers["Authorization"] = "Bearer " + response.json()["token"]
        yield client
