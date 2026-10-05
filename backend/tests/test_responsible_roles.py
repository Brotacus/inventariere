"""Run from backend: python -m pytest -q. Uses temporary databases only."""
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile

import pytest

from fastapi.testclient import TestClient
from app.main import app
from tests.tagging import next_tag


def create(c, path, data):
    response = c.post(path, json=data)
    assert response.status_code == 201, response.text
    return response.json()


def person(c, responsible=False, borrower=True, name='Person'):
    return create(c, '/people/', dict(name=name, is_responsible=responsible, is_borrower=borrower))


def device(c, owner=None):
    location = create(c, '/locations/', {'name': 'Room'})
    return create(c, '/devices/', dict(name='Camera', category='Video', location_id=location['id'], responsible_person_id=owner, tag_code=next_tag(c)))


def test_assignment_survives_loan_return_and_can_change_during_loan(client):
    c = client
    owner = person(c, True, False, 'Owner')
    other = person(c, True, False, 'Other owner')
    borrower = person(c, name='Borrower')
    d = device(c, owner['id'])
    loan = create(c, '/loans/', {'device_id': d['id'], 'person_id': borrower['id']})
    assert c.get(f"/devices/{d['id']}").json()['responsible_person_id'] == owner['id']
    response = c.put(f"/devices/{d['id']}", json={'responsible_person_id': other['id']})
    assert response.status_code == 200, response.text
    assert c.post(f"/loans/{loan['id']}/return").status_code == 200
    assert c.get(f"/devices/{d['id']}").json()['responsible_person_id'] == other['id']
    assert len(c.get(f"/people/{other['id']}/devices").json()) == 1
    assert c.get('/journal/?event_type=DEVICE_RESPONSIBLE_CHANGED').json()


def test_roles_are_enforced_on_both_flows(client):
    owner = person(client, True, False)
    borrower = person(client)
    d = device(client)
    assert client.put(f"/devices/{d['id']}", json={'responsible_person_id': borrower['id']}).status_code == 409
    assert client.put(f"/devices/{d['id']}", json={'responsible_person_id': 9999}).status_code == 404
    assert client.post('/loans/', json={'device_id': d['id'], 'person_id': owner['id']}).status_code == 409
    assert client.post('/people/', json={'name': 'No role', 'is_responsible': False, 'is_borrower': False}).status_code == 400
    assert client.get('/people/?role=invalid').status_code == 422
    assert [p['id'] for p in client.get('/people/?role=responsible').json()] == [owner['id']]
    assert [p['id'] for p in client.get('/people/?role=borrower').json()] == [borrower['id']]


def test_assigned_owner_cannot_be_deactivated_or_lose_role(client):
    owner = person(client, True)
    d = device(client, owner['id'])
    for payload in ({'active': False}, {'is_responsible': False}):
        assert client.put(f"/people/{owner['id']}", json=payload).status_code == 409
    assert client.delete(f"/people/{owner['id']}").status_code == 409
    assert client.put(f"/devices/{d['id']}", json={'responsible_person_id': None}).status_code == 200
    assert client.delete(f"/people/{owner['id']}").status_code == 200
    assert client.put(f"/devices/{d['id']}", json={'responsible_person_id': owner['id']}).status_code == 409


def test_active_borrower_cannot_lose_role_and_null_is_rejected(client):
    p = person(client, True, True)
    d = device(client, p['id'])
    create(client, '/loans/', dict(device_id=d['id'], person_id=p['id']))
    assert client.put(f"/people/{p['id']}", json={'is_borrower': False}).status_code == 409
    for field in ('active', 'is_borrower', 'is_responsible'):
        assert client.put(f"/people/{p['id']}", json={field: None}).status_code == 400
    assert client.get(f"/devices/{d['id']}").json()['responsible_person_id'] == p['id']


def test_loan_without_owner_does_not_create_assignment(client):
    p = person(client)
    d = device(client)
    loan = create(client, '/loans/', dict(device_id=d['id'], person_id=p['id']))
    assert client.get(f"/devices/{d['id']}").json()['responsible_person_id'] is None
    assert client.post(f"/loans/{loan['id']}/return").status_code == 200
    assert client.get(f"/devices/{d['id']}").json()['responsible_person_id'] is None


def test_legacy_migration_is_automatic_idempotent_and_preserves_data(tmp_path):
    db = tmp_path / 'legacy.db'
    with sqlite3.connect(db) as con:
        con.executescript('''
        CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE locations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT);
        CREATE TABLE devices (id INTEGER PRIMARY KEY, code TEXT, name TEXT, category TEXT, serial_number TEXT, status TEXT, location_id INTEGER, responsible_person_id INTEGER, description TEXT, created_at DATETIME, updated_at DATETIME);
        INSERT INTO people (id,name) VALUES (1,'Existing owner'),(2,'Existing borrower');
        INSERT INTO locations VALUES (1,'Existing room',NULL);
        INSERT INTO devices (id,code,name,category,status,location_id,responsible_person_id) VALUES (1,'DEV-00001','Existing asset','Video','LOANED',1,1);
        ''')
    env = dict(os.environ, DATABASE_URL='sqlite:///' + str(db))
    for _ in range(2):
        subprocess.run([sys.executable, '-c', 'from app.main import app'], env=env, check=True, capture_output=True)
    with sqlite3.connect(db) as con:
        assert con.execute('SELECT is_responsible,is_borrower FROM people ORDER BY id').fetchall() == [(1,1),(0,1)]
        assert con.execute('SELECT responsible_person_id,status FROM devices').fetchone() == (1,'LOANED')
        assert con.execute('SELECT active FROM locations').fetchone() == (1,)
        con.execute('UPDATE people SET is_borrower=0 WHERE id=1')
    subprocess.run([sys.executable, '-c', 'from app.main import app'], env=env, check=True, capture_output=True)
    with sqlite3.connect(db) as con:
        assert con.execute('SELECT is_borrower FROM people WHERE id=1').fetchone() == (0,)


def test_new_routes_require_authentication():
    with TestClient(app) as c:
        assert c.get('/people/1/devices').status_code == 401
