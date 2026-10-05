import json
import ssl

import pytest
from fastapi.testclient import TestClient
from ldap3 import MOCK_SYNC, SYNC, Connection, Server

from app import models
from app.database import SessionLocal
from app.main import app
from app.routes import auth
from app.services import auth_service, ldap_auth

BASE_DN = "dc=example,dc=test"
USERS_DN = f"cn=users,cn=accounts,{BASE_DN}"
GROUP_DN = f"cn=inventory-admins,cn=groups,cn=accounts,{BASE_DN}"


@pytest.fixture
def directory(monkeypatch):
    monkeypatch.setenv("LDAP_SERVER_URI", "ldaps://ipa.example.test")
    monkeypatch.setenv("LDAP_USER_DN_TEMPLATE", f"uid={{username}},{USERS_DN}")
    monkeypatch.setenv("LDAP_REQUIRED_GROUP_DN", GROUP_DN)

    server = Server("ipa.example.test")
    seed = Connection(server, client_strategy=MOCK_SYNC)

    def add_user(uid, password, **attributes):
        seed.strategy.add_entry(f"uid={uid},{USERS_DN}", {
            "objectClass": ["inetOrgPerson"], "uid": uid, "userPassword": password, **attributes,
        })

    # FreeIPA-style memberOf, written with different case and spacing.
    add_user("ana", "parola-ana", cn="Ana", displayName="Ana Popescu",
             memberOf=["CN=Inventory-Admins, cn=groups,cn=accounts,dc=example,dc=test"])
    # Plain OpenLDAP-style: only the group lists the member.
    add_user("bogdan", "parola-bogdan", cn="Bogdan Ionescu")
    add_user("eve", "parola-eve", cn="Eve")
    seed.strategy.add_entry(GROUP_DN, {
        "objectClass": ["groupOfNames"], "cn": "inventory-admins", "member": [f"uid=bogdan,{USERS_DN}"],
    })

    monkeypatch.setattr(ldap_auth, "_server", lambda config: server)
    monkeypatch.setattr(ldap_auth, "CLIENT_STRATEGY", MOCK_SYNC)
    return server


def ldap_login(public, username, password):
    return public.post("/auth/login", json={"username": username, "password": password})


def test_ldap_member_logs_in_with_directory_identity(client, directory):
    with TestClient(app) as public:
        assert public.get("/auth/methods").json() == {"password": True, "ldap": True}

        response = ldap_login(public, "ana", "parola-ana")
        assert response.status_code == 200, response.text
        body = response.json()
        assert (body["admin"], body["username"], body["method"]) == ("Ana Popescu", "ana", "ldap")

        public.headers["Authorization"] = "Bearer " + body["token"]
        assert public.get("/auth/me").json() == {
            "authenticated": True, "admin": "Ana Popescu", "username": "ana", "method": "ldap",
        }
        assert public.get("/devices/").status_code == 200
        assert public.post("/auth/logout").status_code == 200
        assert public.get("/auth/me").status_code == 401

    with SessionLocal() as db:
        events = {event.event_type: event for event in db.query(models.AuditEvent).all()}
    assert json.loads(events["ADMIN_LOGIN"].details_json)["username"] == "ana"
    assert "Ana Popescu" in events["ADMIN_LOGOUT"].description


def test_ldap_group_membership_is_read_from_the_group_entry(client, directory):
    with TestClient(app) as public:
        response = ldap_login(public, "bogdan", "parola-bogdan")
    assert response.status_code == 200, response.text
    assert response.json()["admin"] == "Bogdan Ionescu"


def test_ldap_rejections_count_toward_the_login_lockout(client, directory):
    auth_service._SESSIONS.clear()
    with TestClient(app) as public:
        assert ldap_login(public, "eve", "parola-eve").status_code == 403
        assert ldap_login(public, "ana", "greșită").status_code == 401
        # Filter/DN metacharacters never reach the directory.
        assert ldap_login(public, "ana)(uid=*", "parola-ana").status_code == 401
        assert ldap_login(public, "uid=ana,cn=users", "parola-ana").status_code == 401
        # The fifth failure starts the lockout, which also blocks valid accounts.
        assert ldap_login(public, "nimeni", "parola-ana").status_code == 429
        locked = ldap_login(public, "ana", "parola-ana")
    assert locked.status_code == 429
    assert not auth_service._SESSIONS


def test_ldap_outage_is_reported_without_locking_users_out(client, directory, monkeypatch):
    # Nothing listens on port 1: a real socket error from ldap3.
    monkeypatch.setattr(ldap_auth, "_server", lambda config: Server("127.0.0.1", port=1, connect_timeout=1))
    monkeypatch.setattr(ldap_auth, "CLIENT_STRATEGY", SYNC)
    auth._FAILED_ATTEMPTS.clear()
    with TestClient(app) as public:
        for _ in range(auth.MAX_FAILED_ATTEMPTS + 1):
            response = ldap_login(public, "ana", "parola-ana")
            assert response.status_code == 503
            assert "127.0.0.1" not in response.text
    assert not auth._FAILED_ATTEMPTS


@pytest.mark.parametrize("name, value", [
    ("LDAP_SERVER_URI", "ldap://ipa.example.test"),
    ("LDAP_SERVER_URI", "ldaps://ipa.example.test/dc=example"),
    ("LDAP_START_TLS", "true"),
    ("LDAP_USER_DN_TEMPLATE", USERS_DN),
    ("LDAP_USER_DN_TEMPLATE", "uid={username},{other}," + USERS_DN),
    ("LDAP_REQUIRED_GROUP_DN", ""),
    ("LDAP_CA_CERT_FILE", "/nonexistent/ipa-ca.crt"),
])
def test_ldap_misconfiguration_fails_closed(client, directory, monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with TestClient(app) as public:
        assert ldap_login(public, "ana", "parola-ana").status_code == 503


def test_ldap_sessions_follow_the_configuration(client, directory, monkeypatch):
    with TestClient(app) as public:
        token = ldap_login(public, "ana", "parola-ana").json()["token"]
        ldap_session = {"Authorization": f"Bearer {token}"}
        assert public.get("/auth/me", headers=ldap_session).status_code == 200

        # Removing the shared password ends local sessions, not LDAP ones.
        monkeypatch.delenv("ADMIN_PASSWORD")
        assert client.get("/auth/me").status_code == 401
        assert public.get("/auth/me", headers=ldap_session).status_code == 200
        assert public.get("/auth/methods").json() == {"password": False, "ldap": True}
        assert public.post("/auth/login", json={"password": "test-only-password"}).status_code == 503

        # Changing who may log in revokes sessions issued under the old rule.
        monkeypatch.setenv("LDAP_REQUIRED_GROUP_DN", f"cn=other,{BASE_DN}")
        assert public.get("/auth/me", headers=ldap_session).status_code == 401


def test_username_login_requires_ldap_to_be_configured(client, monkeypatch):
    monkeypatch.setenv("LDAP_SERVER_URI", "")
    with TestClient(app) as public:
        assert public.get("/auth/methods").json() == {"password": True, "ldap": False}
        assert ldap_login(public, "admin", "test-only-password").status_code == 503
    assert not auth._FAILED_ATTEMPTS


@pytest.mark.parametrize("uri, use_ssl, start_tls", [
    ("ldaps://ipa.example.test", True, ""),
    ("ldap://ipa.example.test", False, "true"),
])
def test_ldap_connections_verify_the_server_certificate(monkeypatch, uri, use_ssl, start_tls):
    monkeypatch.setenv("LDAP_SERVER_URI", uri)
    monkeypatch.setenv("LDAP_START_TLS", start_tls)
    monkeypatch.setenv("LDAP_USER_DN_TEMPLATE", f"uid={{username}},{USERS_DN}")
    monkeypatch.setenv("LDAP_REQUIRED_GROUP_DN", GROUP_DN)
    config = ldap_auth.load_config()
    server = ldap_auth._server(config)
    assert server.ssl is use_ssl
    assert server.port == (636 if use_ssl else 389)
    assert server.tls.validate == ssl.CERT_REQUIRED
    assert server.tls.sni == "ipa.example.test"
