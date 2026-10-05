"""Business invariants, concurrent actions and hostile raster input regressions."""
from concurrent.futures import ThreadPoolExecutor
import asyncio
import io

import httpx
from PIL import Image, PngImagePlugin

from app import models
from app.database import SessionLocal
from app.main import app
from app.routes import devices
from app.services import email_service
from tests.tagging import next_tag, next_tags


def create(client, path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def inventory(client):
    location = create(client, "/locations/", {"name": "Room"})
    person = create(client, "/people/", {"name": "Borrower"})
    device = create(client, "/devices/", {"name": "Camera", "category": "Video", "location_id": location["id"], "tag_code": next_tag(client)})
    return location, person, device


def png_bytes():
    data = io.BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("private", "GPS coordinates and private metadata")
    Image.new("RGBA", (3, 2), "red").save(data, format="PNG", pnginfo=metadata)
    return data.getvalue()


def test_null_updates_do_not_corrupt_required_fields(client):
    location, _, device = inventory(client)
    assert client.put(f"/devices/{device['id']}", json={"status": None}).status_code == 400
    assert client.put(f"/locations/{location['id']}", json={"active": None}).status_code == 400
    assert client.get(f"/devices/{device['id']}").json()["status"] == "AVAILABLE"
    assert client.get(f"/locations/{location['id']}").json()["active"] is True


def test_write_limits_and_email_validation_preserve_inventory(client):
    location, person, device = inventory(client)
    requests = [
        ("POST", "/devices/", {"name": "x" * 201, "category": "Video", "location_id": location["id"], "tag_code": next_tag(client)}),
        ("PUT", f"/devices/{device['id']}", {"description": "x" * 10001}),
        ("POST", "/people/", {"name": "Somebody", "email": "victim@example.com\nBcc: attacker@example.com"}),
        ("PUT", f"/people/{person['id']}", {"email": "not an email"}),
        ("POST", "/locations/", {"name": "x" * 201}),
        ("POST", "/loans/", {"device_id": 0, "person_id": person["id"]}),
    ]
    for method, path, data in requests:
        response = client.request(method, path, json=data)
        assert response.status_code == 422, response.text
    with SessionLocal() as db:
        assert db.query(models.Device).count() == 1
        assert db.query(models.Person).count() == 1
        assert db.query(models.Location).count() == 1
        assert db.query(models.Loan).count() == 0


def test_deleted_device_identity_and_catalog_url_are_not_reused(client):
    location, _, old = inventory(client)
    assert client.delete(f"/devices/{old['id']}").status_code == 200
    new = create(client, "/devices/", {"name": "Replacement", "category": "Video", "location_id": location["id"], "tag_code": next_tag(client)})
    assert new["id"] > old["id"]
    assert new["code"] != old["code"]
    assert client.get(f"/public/assets/catalog/{old['code']}").status_code == 404
    assert client.get(f"/public/assets/catalog/{new['code']}").json()["name"] == "Replacement"
    with SessionLocal() as db:
        old_events = db.query(models.AuditEvent).filter(models.AuditEvent.device_id == old["id"]).all()
        assert {event.event_type for event in old_events} == {"DEVICE_CREATED", "DEVICE_DELETED"}


def test_concurrent_creations_have_unique_persistent_codes(client):
    location = create(client, "/locations/", {"name": "Room"})
    tags = next_tags(client, 8)
    def submit(index):
        return client.post("/devices/", json={"name": f"Asset {index}", "category": "Video", "location_id": location["id"], "tag_code": tags[index]})
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(submit, range(8)))
    assert all(response.status_code == 201 for response in responses), [response.text for response in responses]
    assert len({response.json()["code"] for response in responses}) == 8
    with SessionLocal() as db:
        assert db.query(models.Device).count() == 8


def test_concurrent_loan_and_return_create_one_transition(client):
    _, person, device = inventory(client)
    def borrow(_):
        return client.post("/loans/", json={"device_id": device["id"], "person_id": person["id"]})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(borrow, range(2)))
    assert sorted(response.status_code for response in results) == [201, 409], [response.text for response in results]
    loan_id = next(response.json()["id"] for response in results if response.status_code == 201)
    with ThreadPoolExecutor(max_workers=2) as pool:
        returns = list(pool.map(lambda _: client.post(f"/loans/{loan_id}/return"), range(2)))
    assert sorted(response.status_code for response in returns) == [200, 409]
    with SessionLocal() as db:
        assert db.query(models.Loan).count() == 1
        assert db.query(models.Log).filter(models.Log.action == "LOAN_CREATED").count() == 1
        assert db.query(models.Log).filter(models.Log.action == "LOAN_RETURNED").count() == 1
        assert db.get(models.Device, device["id"]).status == "AVAILABLE"


def test_raster_upload_reencodes_pixels_and_strips_metadata(client):
    _, _, device = inventory(client)
    response = client.post(f"/devices/{device['id']}/images", files=[
        ("files", ("../private.png", png_bytes() + b"<script>payload</script>", "text/html")),
    ])
    assert response.status_code == 201, response.text
    result = response.json()[0]
    assert result["content_type"] == "image/png"
    assert result["original_name"] == "private.png"
    filename = result["url"].rsplit("/", 1)[-1]
    stored = devices.UPLOAD_ROOT / str(device["id"]) / filename
    contents = stored.read_bytes()
    assert b"<script>" not in contents
    assert b"GPS coordinates" not in contents
    with Image.open(io.BytesIO(contents)) as image:
        assert image.size == (3, 2)
        assert image.mode == "RGBA"
        assert image.getpixel((0, 0)) == (255, 0, 0, 255)


def test_partial_upload_failure_rolls_back_files_and_metadata(client):
    _, _, device = inventory(client)
    previous_files = set((devices.UPLOAD_ROOT / str(device["id"])).glob("*"))
    response = client.post(f"/devices/{device['id']}/images", files=[
        ("files", ("valid.png", png_bytes(), "image/png")),
        ("files", ("forged.png", b"\x89PNG\r\n\x1a\n<script>invalid</script>", "image/png")),
    ])
    assert response.status_code == 400
    assert set((devices.UPLOAD_ROOT / str(device["id"])).glob("*")) == previous_files
    with SessionLocal() as db:
        assert db.query(models.DeviceImage).count() == 0
        assert db.query(models.Log).filter(models.Log.action == "DEVICE_IMAGE_UPLOADED").count() == 0


def test_pixel_limit_rejects_small_compressed_bomb(client, monkeypatch):
    _, _, device = inventory(client)
    monkeypatch.setattr(devices, "MAX_IMAGE_PIXELS", 5)
    response = client.post(f"/devices/{device['id']}/images", files={"files": ("image.png", png_bytes(), "image/png")})
    assert response.status_code == 413
    with SessionLocal() as db:
        assert db.query(models.DeviceImage).count() == 0


def test_image_deletion_cannot_follow_traversal_in_legacy_metadata(client):
    _, _, device = inventory(client)
    with SessionLocal() as db:
        row = models.DeviceImage(device_id=device["id"], stored_name="../../private.txt", original_name="old.png", content_type="image/png")
        db.add(row)
        db.commit()
        image_id = row.id
    assert client.delete(f"/devices/{device['id']}/images/{image_id}").status_code == 400
    with SessionLocal() as db:
        assert db.get(models.DeviceImage, image_id) is not None


def test_public_base_url_rejects_credentials_and_broken_paths(client):
    _, _, device = inventory(client)
    for base_url in ("javascript:alert(1)", "https://user:pass@example.com", "http://example.com:bad", "http://example.com/#admin", "http://example.com/?redirect=evil", "http://example.com\\evil", "http://[broken", "http://example.com/admin"):
        response = client.post(f"/devices/{device['id']}/public-access", json={"base_url": base_url})
        assert response.status_code == 400, response.text
    with SessionLocal() as db:
        assert db.query(models.DevicePublicLink).count() == 0


def test_html_email_escapes_inventory_fields(monkeypatch):
    sent = []
    class SMTP:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def ehlo(self):
            pass
        def starttls(self, **kwargs):
            pass
        def send_message(self, message):
            sent.append(message)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "inventory@example.com")
    monkeypatch.setenv("SMTP_USE_SSL", "false")
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    monkeypatch.setattr(email_service.smtplib, "SMTP", SMTP)
    email_service.send_loan_email("borrower@example.com", "<script>bad</script>", "<img src=x>", "DEV-00001", 1)
    html = sent[0].get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html and "<img src=x>" not in html
    assert "&lt;script&gt;bad&lt;/script&gt;" in html and "&lt;img src=x&gt;" in html


def test_smtp_credentials_are_never_sent_without_encryption(monkeypatch):
    import pytest
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "inventory@example.com")
    monkeypatch.setenv("SMTP_USER", "inventory@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "private")
    monkeypatch.setenv("SMTP_USE_TLS", "false")
    monkeypatch.setenv("SMTP_USE_SSL", "false")
    with pytest.raises(RuntimeError, match="requires TLS or SSL"):
        email_service.send_loan_email("borrower@example.com", "Borrower", "Camera", "DEV-00001", 1)


def test_slow_public_login_does_not_block_authenticated_inventory_writes(client):
    """An anonymous unfinished body must never hold the inventory write lock."""
    async def scenario():
        body_started = asyncio.Event()
        finish_body = asyncio.Event()

        async def slow_body():
            body_started.set()
            yield b'{"password":'
            await finish_body.wait()
            yield b'"incorrect-password"}'

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as transport:
            login = asyncio.create_task(transport.post(
                "/auth/login", content=slow_body(), headers={"Content-Type": "application/json"},
            ))
            await asyncio.wait_for(body_started.wait(), timeout=2)
            try:
                mutation = await asyncio.wait_for(transport.post(
                    "/notifications/read-all", headers={"Authorization": client.headers["Authorization"]},
                ), timeout=2)
                assert mutation.status_code == 200, mutation.text
            finally:
                finish_body.set()
                response = await asyncio.wait_for(login, timeout=2)
                assert response.status_code == 401, response.text

    asyncio.run(scenario())
