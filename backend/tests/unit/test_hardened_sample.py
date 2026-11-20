"""Behavioural tests for sandbox/Sample_test.py (the hardened output) plus a scanner pass."""
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SANDBOX_FILE = ROOT / "sandbox" / "Sample_test.py"
sys.path.insert(0, str(ROOT / "backend"))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("JWT_SECRET", "x" * 48)
    monkeypatch.setenv("DB_PATH", str(tmp_path / "t.db"))
    monkeypatch.setenv("ADMIN_BOOTSTRAP_PASSWORD", "Adm1n-bootstrap-pass")
    spec = importlib.util.spec_from_file_location("hardened_app", SANDBOX_FILE)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return TestClient(mod.app), mod


def _login(c, user, pw):
    r = c.post("/login", json={"username": user, "password": pw})
    return r, {"Authorization": f"Bearer {r.json().get('session_token', '')}"}


def test_scanner_finds_no_critical_or_high():
    from app.tools.source_verifier import scan, syntax_ok

    code = SANDBOX_FILE.read_text()
    assert syntax_ok(code)
    assert [f for f in scan(code) if f["severity"] in ("critical", "high")] == []


def test_fails_closed_without_secret(monkeypatch, tmp_path):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setenv("DB_PATH", str(tmp_path / "t.db"))
    spec = importlib.util.spec_from_file_location("hardened_app2", SANDBOX_FILE)
    with pytest.raises(RuntimeError):
        spec.loader.exec_module(importlib.util.module_from_spec(spec))


def test_sqli_payload_does_not_authenticate(client):
    c, _ = client
    r = c.post("/login", json={"username": "admin' OR '1'='1' --", "password": "x"})
    assert r.status_code == 401


def test_passwords_are_bcrypt_hashed_and_never_returned(client):
    c, mod = client
    assert c.post("/register", json={"username": "alice", "password": "correct-horse-battery"}).status_code == 200
    import sqlite3

    stored = sqlite3.connect(mod.DB_PATH).execute("SELECT password_hash FROM users WHERE username='alice'").fetchone()[0]
    assert stored.startswith("$2") and "correct-horse" not in stored
    r, h = _login(c, "alice", "correct-horse-battery")
    uid = r.json()["user_id"]
    body = c.get(f"/users/{uid}", headers=h).json()
    assert set(body) == {"id", "username", "role"}


def test_weak_registration_rejected(client):
    c, _ = client
    assert c.post("/register", json={"username": "bob", "password": "short"}).status_code == 422


def test_session_token_is_signed_and_expiring(client):
    c, mod = client
    _, h = _login(c, "admin", "Adm1n-bootstrap-pass")
    import jwt

    claims = jwt.decode(h["Authorization"].split()[1], mod.JWT_SECRET, algorithms=["HS256"])
    assert "exp" in claims and claims["role"] == "admin"
    forged = jwt.encode({"sub": "1", "role": "admin", "exp": 9999999999}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
    assert c.get("/users/1", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    assert c.get("/users/1").status_code == 401


def test_idor_blocked_but_admin_allowed(client):
    c, _ = client
    c.post("/register", json={"username": "alice", "password": "correct-horse-battery"})
    c.post("/register", json={"username": "mallory", "password": "another-long-password"})
    ra, ha = _login(c, "alice", "correct-horse-battery")
    _, hm = _login(c, "mallory", "another-long-password")
    _, hadmin = _login(c, "admin", "Adm1n-bootstrap-pass")
    uid = ra.json()["user_id"]
    assert c.get(f"/users/{uid}", headers=hm).status_code == 403
    assert c.get(f"/users/{uid}", headers=ha).status_code == 200
    assert c.get(f"/users/{uid}", headers=hadmin).status_code == 200


def test_admin_delete_requires_admin_role(client):
    c, _ = client
    c.post("/register", json={"username": "alice", "password": "correct-horse-battery"})
    ra, ha = _login(c, "alice", "correct-horse-battery")
    _, hadmin = _login(c, "admin", "Adm1n-bootstrap-pass")
    uid = ra.json()["user_id"]
    assert c.delete(f"/admin/delete-user/{uid}").status_code == 401
    assert c.delete(f"/admin/delete-user/{uid}", headers=ha).status_code == 403
    assert c.delete(f"/admin/delete-user/{uid}", headers=hadmin).status_code == 200
    assert c.delete(f"/admin/delete-user/{uid}", headers=hadmin).status_code == 404


def test_ping_rejects_injection_and_requires_auth(client):
    c, _ = client
    _, hadmin = _login(c, "admin", "Adm1n-bootstrap-pass")
    assert c.get("/diagnostics/ping", params={"host": "127.0.0.1"}).status_code == 401
    for bad in ["127.0.0.1; id", "$(id)", "-c 5 x", "a b", "`id`", "127.0.0.1 && ls"]:
        assert c.get("/diagnostics/ping", params={"host": bad}, headers=hadmin).status_code == 422, bad


def test_import_is_json_only(client):
    c, _ = client
    _, hadmin = _login(c, "admin", "Adm1n-bootstrap-pass")
    import pickle

    assert c.post("/session/import", content=json.dumps({"a": 1})).status_code == 401
    assert c.post("/session/import", content=pickle.dumps({"a": 1}), headers=hadmin).status_code == 400
    ok = c.post("/session/import", content=json.dumps({"a": 1}), headers=hadmin)
    assert ok.status_code == 200 and ok.json() == {"loaded_session": {"a": 1}}


def test_login_lockout(client):
    c, _ = client
    for _i in range(5):
        assert c.post("/login", json={"username": "admin", "password": "nope"}).status_code == 401
    assert c.post("/login", json={"username": "admin", "password": "Adm1n-bootstrap-pass"}).status_code == 429
