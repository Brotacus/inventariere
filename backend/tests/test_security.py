import asyncio
import base64
import json
import sqlite3
import zipfile
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace

import pytest
import httpx
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import models
import app.main as main
from app.database import SessionLocal
from app.main import app
from app.routes import admin, auth
from app.services import auth_service, backup
from app.services import security_middleware
from app.services.security import UPLOAD_DIR

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII="
)


def seed_photo(content_type="image/png", filename="proof.png"):
    # conftest points database, uploads and backups at one disposable directory.
    assert UPLOAD_DIR.name == "uploads" and "inventory-tests-" in str(UPLOAD_DIR.parent)
    with SessionLocal() as db:
        location = models.Location(name="Test storage", active=1)
        db.add(location)
        db.flush()
        device = models.Device(code="DEV-SECURITY", name="Camera", category="Video", location_id=location.id)
        db.add(device)
        db.flush()
        db.add(models.DeviceImage(device_id=device.id, stored_name=filename, original_name="private-name.png", content_type=content_type))
        db.commit()
        device_id = device.id
    photo = UPLOAD_DIR / "devices" / str(device_id) / filename
    photo.parent.mkdir(parents=True, exist_ok=True)
    photo.write_bytes(PNG)
    return device_id, photo


def test_unicode_login_logout_and_credential_rotation(client, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "Parolă-Știință-🔑")
    with TestClient(app) as public:
        assert public.post("/auth/login", json={"password": "greșită"}).status_code == 401
        result = public.post("/auth/login", json={"password": "Parolă-Știință-🔑"})
        assert result.status_code == 200, result.text
        token = result.json()["token"]
        public.headers["Authorization"] = "Bearer " + token
        assert public.get("/auth/me").status_code == 200
        assert public.post("/auth/logout").status_code == 200
        assert public.get("/auth/me").status_code == 401

        second = public.post("/auth/login", json={"password": "Parolă-Știință-🔑"}).json()["token"]
        public.headers["Authorization"] = "Bearer " + second
        monkeypatch.setenv("ADMIN_PASSWORD", "noua-parolă")
        assert public.get("/auth/me").status_code == 401
        # Escaped unpaired Unicode must produce an ordinary rejected credential.
        malformed = public.post("/auth/login", content=b'{"password":"\\ud800"}', headers={"Content-Type": "application/json"})
        assert malformed.status_code == 422
        assert all("input" not in error for error in malformed.json()["detail"])
        oversized = public.post("/auth/login", json={"password": "secret-value-" * 50})
        assert oversized.status_code == 422 and "secret-value" not in oversized.text


def test_reset_code_is_never_a_login_fallback(client, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD")
    monkeypatch.setenv("ADMIN_CLEAR_CODE", "reset-only-code")
    assert auth_service.get_configured_password() is None
    assert not auth_service.password_is_valid("reset-only-code")
    with TestClient(app) as public:
        assert public.post("/auth/login", json={"password": "reset-only-code"}).status_code == 503


def test_login_lockout_retry_after_and_expiration(client, monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(auth, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    with TestClient(app) as public:
        for _ in range(4):
            assert public.post("/auth/login", json={"password": "wrong"}).status_code == 401
        response = public.post("/auth/login", json={"password": "wrong"})
        assert response.status_code == 429
        assert response.headers["Retry-After"] == "30"
        assert public.post("/auth/login", json={"password": "test-only-password"}).status_code == 429
        clock[0] += 31
        assert public.post("/auth/login", json={"password": "test-only-password"}).status_code == 200
        for _ in range(4):
            assert public.post("/auth/login", json={"password": "wrong"}).status_code == 401
        clock[0] += auth.ATTEMPT_WINDOW_SECONDS + 1
        assert public.post("/auth/login", json={"password": "wrong"}).status_code == 401


def test_session_expiration_and_bounded_state(client, monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(auth_service, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    monkeypatch.setenv("ADMIN_SESSION_TTL_SECONDS", "300")
    token, ttl = auth_service.create_session()
    assert ttl == 300 and auth_service.is_session_valid(token)
    clock[0] += 301
    assert not auth_service.is_session_valid(token)
    monkeypatch.setattr(auth_service, "MAX_SESSIONS", 2)
    auth_service._SESSIONS.clear()
    first, _ = auth_service.create_session()
    second, _ = auth_service.create_session()
    third, _ = auth_service.create_session()
    assert len(auth_service._SESSIONS) == 2
    assert not auth_service.is_session_valid(first)
    assert auth_service.is_session_valid(second) and auth_service.is_session_valid(third)

    monkeypatch.setattr(auth, "MAX_TRACKED_CLIENTS", 2)
    for key in ("client1", "client2", "client3"):
        auth._record_failed_attempt(key)
    assert len(auth._FAILED_ATTEMPTS) <= 2


def test_security_headers_cors_and_docs_default(client):
    with TestClient(app) as public:
        response = public.get("/people/", headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 401
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
        assert response.headers["Cache-Control"] == "no-store"
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "no-referrer"
        assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]
        for origin in ("https://untrusted.example", "http://192.168.1.5:9999", "null"):
            response = public.get("/public/assets/catalog", headers={"Origin": origin})
            assert response.status_code == 200
            assert "Access-Control-Allow-Origin" not in response.headers
        preflight = public.options("/devices/", headers={
            "Origin": "http://192.168.1.5:5173", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization,Content-Type",
        })
        assert preflight.status_code == 200
        assert preflight.headers["Access-Control-Allow-Origin"] == "http://192.168.1.5:5173"
        assert "Access-Control-Allow-Credentials" not in preflight.headers
        for path in ("/docs", "/redoc", "/openapi.json"):
            # Disabled documentation also stays unreachable with an admin token.
            assert client.get(path).status_code == 404
    with TestClient(app, base_url="https://testserver") as public:
        assert public.get("/").headers["Strict-Transport-Security"] == "max-age=31536000"


def test_public_images_only_serve_recorded_rasters(client):
    device_id, photo = seed_photo()
    url = f"/uploads/devices/{device_id}/{photo.name}"
    with TestClient(app) as public:
        response = public.get(url)
        assert response.status_code == 200 and response.content == PNG
        assert response.headers["Content-Type"] == "image/png"
        assert "private-name" not in str(response.headers)
        assert public.head(url).status_code == 200
        stray = photo.parent / "internal.txt"
        stray.write_text("internal data", encoding="utf-8")
        assert public.get(f"/uploads/devices/{device_id}/internal.txt").status_code == 404
        assert public.get("/uploads/inventory.db").status_code == 404
        assert public.get(f"/uploads/devices/{device_id}/%2e%2e%5Cinternal.txt").status_code == 404
        with SessionLocal() as db:
            image = db.query(models.DeviceImage).one()
            image.content_type = "image/svg+xml"
            db.commit()
        assert public.get(url).status_code == 404


def test_backup_and_unicode_reset_preserve_a_complete_recovery_point(client, monkeypatch, tmp_path):
    device_id, photo = seed_photo()
    monkeypatch.setenv("ADMIN_CLEAR_CODE", "Resetare-ș-🔒")
    assert client.post("/admin/clear-data", json={"code": "greșit"}).status_code == 403
    assert photo.read_bytes() == PNG
    result = client.post("/admin/clear-data", json={"code": "Resetare-ș-🔒"})
    assert result.status_code == 200, result.text
    assert result.json()["deleted"]["devices"] == 1
    assert not photo.exists()
    assert not result.json()["cleanup_pending"]
    with zipfile.ZipFile(result.json()["backup_path"]) as archive:
        assert archive.testzip() is None
        assert archive.read(f"uploads/devices/{device_id}/{photo.name}") == PNG
        assert json.loads(archive.read("manifest.json"))["uploaded_files"] == 1
        restored_db = tmp_path / "snapshot.db"
        restored_db.write_bytes(archive.read("inventory.db"))
    with closing(sqlite3.connect(restored_db)) as db:
        assert db.execute("select count(*) from devices").fetchone()[0] == 1
        assert db.execute("select count(*) from device_images").fetchone()[0] == 1
    with SessionLocal() as db:
        assert db.query(models.Device).count() == db.query(models.DeviceImage).count() == 0
    assert client.get("/public/assets/catalog").json()["total"] == 0


@pytest.mark.parametrize("failure", ["error", "unavailable"])
def test_reset_refuses_to_destroy_data_without_complete_backup(client, monkeypatch, failure):
    _, photo = seed_photo()
    monkeypatch.setenv("ADMIN_CLEAR_CODE", "reset-test")

    def fail_backup(label):
        if failure == "unavailable":
            return None
        raise backup.BackupError("simulated disk failure")

    monkeypatch.setattr(admin, "create_database_backup", fail_backup)
    result = client.post("/admin/clear-data", json={"code": "reset-test"})
    assert result.status_code == 503
    assert photo.read_bytes() == PNG
    with SessionLocal() as db:
        assert db.query(models.Device).count() == db.query(models.DeviceImage).count() == 1


def test_failed_reset_commit_restores_photos_and_database(client, monkeypatch):
    _, photo = seed_photo()
    monkeypatch.setenv("ADMIN_CLEAR_CODE", "reset-test")
    with SessionLocal() as db:
        def fail_commit():
            raise RuntimeError("simulated failed commit")

        monkeypatch.setattr(db, "commit", fail_commit)
        with pytest.raises(RuntimeError, match="simulated failed commit"):
            admin.clear_all_application_data(SimpleNamespace(code="reset-test"), db)
    assert photo.read_bytes() == PNG
    with SessionLocal() as db:
        assert db.query(models.Device).count() == db.query(models.DeviceImage).count() == 1


def test_backup_directory_cannot_be_nested_under_uploads(client, monkeypatch):
    seed_photo()
    monkeypatch.setenv("BACKUP_DIR", str(UPLOAD_DIR / "unsafe-backups"))
    with pytest.raises(backup.BackupError, match="outside UPLOAD_DIR"):
        backup.create_database_backup()


def test_reset_does_not_reuse_inventory_ids_or_catalog_urls(client, monkeypatch):
    monkeypatch.setenv("ADMIN_CLEAR_CODE", "reset-test")

    def create_inventory():
        location = client.post("/locations/", json={"name": "Storage"})
        assert location.status_code == 201, location.text
        person = client.post("/people/", json={"name": "Borrower", "is_borrower": True})
        assert person.status_code == 201, person.text
        device = client.post("/devices/", json={
            "name": "Camera", "category": "Video", "location_id": location.json()["id"],
        })
        assert device.status_code == 201, device.text
        loan = client.post("/loans/", json={"device_id": device.json()["id"], "person_id": person.json()["id"]})
        assert loan.status_code == 201, loan.text
        return [response.json() for response in (location, person, device, loan)]

    before = create_inventory()
    assert client.post("/admin/clear-data", json={"code": "reset-test"}).status_code == 200
    after = create_inventory()
    assert all(new["id"] > old["id"] for old, new in zip(before, after))
    assert before[2]["code"] != after[2]["code"]
    assert client.get("/public/assets/catalog/" + before[2]["code"]).status_code == 404
    assert client.get("/public/assets/catalog/" + after[2]["code"]).status_code == 200


def test_queued_write_rechecks_revoked_session(client, monkeypatch):
    token = client.headers["Authorization"][7:]
    assert auth_service.is_session_valid(token)

    class RevokedWhileWaiting:
        async def __aenter__(self):
            auth_service.revoke_session(token)

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(main, "_mutation_lock", lambda: RevokedWhileWaiting())
    request = Request({
        "type": "http", "method": "POST", "path": "/notifications/read-all",
        "headers": [(b"authorization", client.headers["Authorization"].encode("ascii"))],
        "scheme": "http", "server": ("testserver", 80), "query_string": b"",
    })

    async def forbidden_mutation(request):
        pytest.fail("A queued request with a revoked session must not execute")

    assert asyncio.run(main.require_admin_session(request, forbidden_mutation)).status_code == 401


def test_unexpected_errors_do_not_expose_internal_details(client, monkeypatch):
    def fail_auth(token):
        raise RuntimeError("private database credentials")

    monkeypatch.setattr(main, "get_session", fail_auth)
    with TestClient(app, raise_server_exceptions=False) as public:
        response = public.get("/people/")
    assert response.status_code == 500
    assert "private" not in response.text and "RuntimeError" not in response.text
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_declared_body_limit_is_early_and_preserves_response_headers(client, monkeypatch):
    monkeypatch.setattr(security_middleware, "MAX_REQUEST_BODY_BYTES", 64)
    response = client.post("/auth/login", content=b"{}", headers={
        "Content-Type": "application/json", "Content-Length": "65", "Origin": "http://localhost:5173",
    })
    assert response.status_code == 413
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert not auth._FAILED_ATTEMPTS


def test_json_body_limit_accepts_exact_boundary(client, monkeypatch):
    body = b'{"password":"test-only-password"}'
    monkeypatch.setattr(security_middleware, "MAX_REQUEST_BODY_BYTES", len(body))
    assert client.post("/auth/login", content=body, headers={"Content-Type": "application/json"}).status_code == 200
    assert client.post("/auth/login", content=body + b" ", headers={"Content-Type": "application/json"}).status_code == 413


def test_streamed_json_cannot_bypass_body_limit_without_content_length(client, monkeypatch):
    monkeypatch.setattr(security_middleware, "MAX_REQUEST_BODY_BYTES", 64)

    async def send_chunks():
        async def chunks():
            yield b'{"password":"'
            yield b"x" * 60
            yield b'"}'

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as public:
            return await public.post("/auth/login", content=chunks(), headers={
                "Content-Type": "application/json", "Origin": "http://localhost:5173",
            })

    response = asyncio.run(send_chunks())
    assert "Content-Length" not in response.request.headers
    assert response.status_code == 413
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert response.headers["Cache-Control"] == "no-store"
    assert not auth._FAILED_ATTEMPTS


def test_streamed_upload_limit_closes_partially_spooled_files(client, monkeypatch):
    import starlette.formparsers as formparsers

    device_id, original_photo = seed_photo()
    monkeypatch.setattr(security_middleware, "MAX_UPLOAD_BODY_BYTES", 256)
    monkeypatch.setattr(formparsers.MultiPartParser, "spool_max_size", 4)
    created_files = []
    original_factory = formparsers.SpooledTemporaryFile

    def track_temporary_file(*args, **kwargs):
        file = original_factory(*args, **kwargs)
        created_files.append(file)
        return file

    monkeypatch.setattr(formparsers, "SpooledTemporaryFile", track_temporary_file)

    async def send_upload():
        async def chunks():
            yield (
                b'--test-boundary\r\nContent-Disposition: form-data; name="files"; filename="test.png"\r\n'
                b"Content-Type: image/png\r\n\r\n" + b"A" * 32
            )
            yield b"A" * 128
            yield b"\r\n--test-boundary--\r\n"

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as authenticated:
            return await authenticated.post(f"/devices/{device_id}/images", content=chunks(), headers={
                "Content-Type": "multipart/form-data; boundary=test-boundary",
                "Authorization": client.headers["Authorization"],
                "Origin": "http://localhost:5173",
            })

    response = asyncio.run(send_upload())
    assert "Content-Length" not in response.request.headers
    assert response.status_code == 413
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert created_files and all(file.closed for file in created_files)
    assert original_photo.read_bytes() == PNG
    with SessionLocal() as db:
        assert db.query(models.DeviceImage).count() == 1


def test_large_multipart_limit_only_applies_to_upload_endpoint(client, monkeypatch):
    monkeypatch.setattr(security_middleware, "MAX_REQUEST_BODY_BYTES", 32)
    monkeypatch.setattr(security_middleware, "MAX_UPLOAD_BODY_BYTES", 256)
    assert client.post("/auth/login", content=b"x" * 64, headers={"Content-Type": "multipart/form-data; boundary=a"}).status_code == 413
    assert client.post("/devices/1/images", content=b"x" * 64, headers={"Content-Type": "application/json"}).status_code == 413
