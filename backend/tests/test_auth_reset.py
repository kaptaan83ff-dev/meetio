import pytest
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from app.db import Database
from app.main import app


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


@pytest.mark.asyncio
async def test_forgot_password_queues_reset_email(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    email = f"feature2-reset-{uuid4().hex[:8]}@example.com"
    captured = {}

    def fake_delay(user_id: str, token: str):
        captured["user_id"] = user_id
        captured["token"] = token
        return None

    monkeypatch.setattr("app.tasks.notifications.send_password_reset_email.delay", fake_delay)
    monkeypatch.setattr("app.tasks.notifications._send_resend_email", lambda **kwargs: None)
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        register_response = await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "Password123",
                "display_name": "Reset User",
            },
        )
        assert register_response.status_code == 201

        forgot_response = await client.post("/v1/auth/forgot-password", json={"email": email})
        assert forgot_response.status_code == 202

    assert captured["user_id"].startswith("usr_")
    assert captured["token"]


@pytest.mark.asyncio
async def test_reset_password_updates_password_and_revokes_sessions(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    email = f"feature2-reset-flow-{uuid4().hex[:8]}@example.com"
    reset_capture = {}

    def fake_delay(user_id: str, token: str):
        reset_capture["user_id"] = user_id
        reset_capture["token"] = token
        return None

    monkeypatch.setattr("app.tasks.notifications.send_password_reset_email.delay", fake_delay)
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        register_response = await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "Password123",
                "display_name": "Reset Flow",
            },
        )
        assert register_response.status_code == 201

        await Database.get_db()["users"].update_one({"email": email}, {"$set": {"is_verified": True}})
        user = await Database.get_db()["users"].find_one({"email": email})
        assert user is not None

        await Database.get_db()["sessions"].insert_one(
            {
                "token": "session-token-1",
                "user_id": user["id"],
                "created_at": "2026-05-16T00:00:00Z",
                "is_revoked": False,
                "device_info": {},
                "schema_version": 1,
            }
        )

        forgot_response = await client.post("/v1/auth/forgot-password", json={"email": email})
        assert forgot_response.status_code == 202
        assert reset_capture["token"]

        reset_response = await client.post(
            "/v1/auth/reset-password",
            json={"token": reset_capture["token"], "password": "NewPassword123"},
        )
        assert reset_response.status_code == 200

        old_login = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": "Password123"},
        )
        assert old_login.status_code == 400

        new_login = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": "NewPassword123"},
        )
        assert new_login.status_code == 200

    user = await Database.get_db()["users"].find_one({"email": email})
    assert user is not None

    sessions = await Database.get_db()["sessions"].find(
        {"user_id": user["id"], "is_revoked": True}
    ).to_list(length=10)
    assert sessions


@pytest.mark.asyncio
async def test_reset_password_rejects_invalid_token(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr("app.tasks.notifications.send_password_reset_email.delay", lambda *args, **kwargs: None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/reset-password",
            json={"token": "invalid-token", "password": "NewPassword123"},
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "RESET_PASSWORD_BAD_TOKEN"
