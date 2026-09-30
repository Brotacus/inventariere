import pytest

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models


def seed(count=27):
    with SessionLocal() as db:
        location = models.Location(name="Laborator", active=1)
        owner = models.Person(name="Private owner", email="private@example.com", phone="private", is_responsible=1)
        db.add_all([location, owner])
        db.flush()
        for index in range(count):
            db.add(models.Device(code=f"DEV-{index + 1:05}", name=f"Camera {index:02}", category="Video" if index % 2 else "Audio", status="RETIRED" if index == 0 else "AVAILABLE", location_id=location.id, responsible_person_id=owner.id, serial_number=f"SN-{index}", description="Descriere publică"))
        db.commit()


def test_all_devices_without_qr_and_public_allowlist(client):
    seed()
    with TestClient(app) as public:
        result = public.get("/public/assets/catalog")
        assert result.status_code == 200
        data = result.json()
        assert data["total"] == data["filtered_total"] == 27
        assert len(data["items"]) == 24
        page2 = public.get("/public/assets/catalog?page=2").json()
        assert len(page2["items"]) == 3
        assert len({d["code"] for d in data["items"] + page2["items"]}) == 27
        assert page2["items"][-1]["status"] == "RETIRED"
        detail = public.get("/public/assets/catalog/DEV-00001")
        assert detail.status_code == 200
        expected = {"code", "name", "category", "serial_number", "status", "description", "location_name", "location_description", "image_url", "image_count", "created_at", "updated_at"}
        assert set(detail.json()) == expected
        assert all(set(item) == expected for item in data["items"])
        assert "private@example.com" not in result.text + detail.text
        for path in ("/devices/", "/people/", "/logs/", "/journal/"):
            assert public.get(path).status_code == 401
        assert public.post("/devices/", json={}).status_code == 401


def test_filters_sort_pagination_and_empty_catalog(client):
    with TestClient(app) as public:
        assert public.get("/public/assets/catalog").json()["items"] == []
        seed()
        data = public.get("/public/assets/catalog?category=Video&status=AVAILABLE&location=Laborator&sort=name&page_size=3").json()
        assert data["filtered_total"] == 13
        assert [item["name"] for item in data["items"]] == ["Camera 01", "Camera 03", "Camera 05"]
        for q in ("camera 01", "DEV-00002", "SN-1"):
            assert public.get("/public/assets/catalog", params={"q": q}).json()["filtered_total"] > 0
        for q in ("%", "_", "not found"):
            assert public.get("/public/assets/catalog", params={"q": q}).json()["filtered_total"] == 0
        assert public.get("/public/assets/catalog?page=999").json()["page"] == 2
        for query in ("page=0", "page_size=101", "sort=bad", "page_size=0"):
            assert public.get("/public/assets/catalog?" + query).status_code == 422
        assert public.get("/public/assets/catalog/MISSING").status_code == 404


def test_images_qr_revocation_and_current_data(client):
    seed(1)
    with SessionLocal() as db:
        device = db.query(models.Device).one()
        device_id = device.id
        for filename in ("first.png", "second.png"):
            db.add(models.DeviceImage(device_id=device.id, stored_name=filename, original_name="internal-name.png", content_type="image/png"))
        db.commit()
    response = client.post(f"/devices/{device_id}/public-access", json={"base_url": "http://localhost:5173"})
    assert response.status_code == 200, response.text
    token = response.json()["token"]
    with TestClient(app) as public:
        qr = public.get(f"/public/assets/{token}").json()
        detail = public.get("/public/assets/catalog/DEV-00001").json()
        assert qr == detail
        assert detail["image_count"] == 2
        assert detail["image_url"].endswith("/first.png")
        assert public.get("/public/assets/catalog").json()["items"][0] == detail
        assert client.delete(f"/devices/{device_id}/public-access").status_code == 200
        assert public.get(f"/public/assets/{token}").status_code == 404
        assert public.get("/public/assets/catalog/DEV-00001").status_code == 200
        assert client.put(f"/devices/{device_id}", json={"name": "Nume actualizat"}).status_code == 200
        assert public.get("/public/assets/catalog").json()["items"][0]["name"] == "Nume actualizat"
        assert client.delete(f"/devices/{device_id}").status_code == 200
        with SessionLocal() as db:
            assert db.query(models.Log).filter(models.Log.action == "DEVICE_UPDATED").count() == 1
            assert db.query(models.Log).filter(models.Log.device_id == device_id).count() == 0
        assert public.get("/public/assets/catalog").json()["total"] == 0
        assert public.get("/public/assets/catalog/DEV-00001").status_code == 404


@pytest.mark.parametrize("authorization", [None, "Bearer invalid-admin-session"], ids=["anonymous", "invalid-session"])
def test_administration_requires_authentication_and_public_access_stays_available(client, authorization):
    seed(1)
    token = "active-public-qr"
    with SessionLocal() as db:
        device = db.query(models.Device).one()
        person = db.query(models.Person).one()
        location = db.query(models.Location).one()
        device_id, person_id, location_id = device.id, person.id, location.id
        db.add(models.DevicePublicLink(device_id=device_id, token=token, is_active=1))
        notification = models.Notification(event_type="TEST", title="Private activity", message="Administrator-only notification")
        db.add(notification)
        db.commit()
        notification_id = notification.id

    protected_requests = [
        ("GET", "/devices/"),
        ("GET", f"/devices/{device_id}"),
        ("GET", f"/devices/{device_id}/tracking"),
        ("GET", f"/devices/{device_id}/images"),
        ("GET", f"/devices/{device_id}/public-access"),
        ("POST", "/devices/"),
        ("PUT", f"/devices/{device_id}"),
        ("DELETE", f"/devices/{device_id}"),
        ("POST", f"/devices/{device_id}/images"),
        ("DELETE", f"/devices/{device_id}/images/1"),
        ("POST", f"/devices/{device_id}/public-access"),
        ("POST", f"/devices/{device_id}/public-access/regenerate"),
        ("DELETE", f"/devices/{device_id}/public-access"),
        ("GET", "/people/"),
        ("GET", f"/people/{person_id}"),
        ("GET", f"/people/{person_id}/devices"),
        ("POST", "/people/"),
        ("PUT", f"/people/{person_id}"),
        ("DELETE", f"/people/{person_id}"),
        ("GET", "/locations/"),
        ("GET", f"/locations/{location_id}"),
        ("POST", "/locations/"),
        ("PUT", f"/locations/{location_id}"),
        ("DELETE", f"/locations/{location_id}"),
        ("GET", "/loans/"),
        ("GET", "/loans/1"),
        ("POST", "/loans/"),
        ("POST", "/loans/1/return"),
        ("GET", "/logs/"),
        ("GET", "/logs/actions"),
        ("GET", "/journal/"),
        ("GET", "/journal/event-types"),
        ("GET", "/notifications/"),
        ("GET", "/notifications/unread-count"),
        ("POST", "/notifications/read-all"),
        ("POST", f"/notifications/{notification_id}/read"),
        ("GET", "/admin/dashboard"),
        ("POST", "/admin/backup"),
        ("POST", "/admin/clear-data"),
        ("GET", "/auth/me"),
        ("POST", "/auth/logout"),
    ]

    # Use a fresh client: the authenticated fixture prepares an isolated test
    # database, but its Bearer token must never reach the requests under test.
    headers = {"Authorization": authorization} if authorization else {}
    with TestClient(app, headers=headers) as public:
        before = public.get("/public/assets/catalog").json()
        for method, path in protected_requests:
            options = {"json": {}} if method in {"POST", "PUT"} else {}
            response = public.request(method, path, **options)
            assert response.status_code == 401, f"{method} {path}: {response.status_code} {response.text}"

        catalog = public.get("/public/assets/catalog")
        detail = public.get("/public/assets/catalog/DEV-00001")
        qr = public.get(f"/public/assets/{token}")
        assert catalog.status_code == detail.status_code == qr.status_code == 200
        assert catalog.json() == before
        assert detail.json() == qr.json() == catalog.json()["items"][0]
        assert "private@example.com" not in catalog.text + detail.text + qr.text

    with SessionLocal() as db:
        assert db.query(models.Device).count() == 1
        assert db.query(models.Person).count() == 1
        assert db.query(models.Location).count() == 1
        assert db.get(models.Notification, notification_id).is_read == 0
        assert db.query(models.DevicePublicLink).one().token == token
    assert client.get("/auth/me").status_code == 200
