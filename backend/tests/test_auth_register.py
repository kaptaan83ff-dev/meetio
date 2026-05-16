import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4

from app.db import Database
from app.main import app
from app.models.user import User


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


@pytest.mark.asyncio
async def test_register_verification_token_uses_fastapi_users_subject(monkeypatch):
    from fastapi_users.jwt import decode_jwt

    from app.auth.manager import UserManager
    from app.config import settings

    captured: dict[str, str] = {}

    def fake_delay(user_id: str, token: str):
        captured["user_id"] = user_id
        captured["token"] = token

    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", fake_delay)

    user = User(
        id="usr_testverifytoken",
        email="verify-token@example.com",
        hashed_password="hashed",
        display_name="Verify Token",
    )
    manager = UserManager(user_db=None)

    await manager.on_after_register(user)

    decoded = decode_jwt(
        captured["token"],
        settings.SECRET_KEY,
        [manager.verification_token_audience],
    )
    assert decoded["sub"] == "usr_testverifytoken"
    assert "user_id" not in decoded


@pytest.mark.asyncio
async def test_request_verify_hook_enqueues_verification_email(monkeypatch):
    from app.auth.manager import UserManager

    captured: dict[str, str] = {}

    def fake_delay(user_id: str, token: str):
        captured["user_id"] = user_id
        captured["token"] = token

    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", fake_delay)

    user = User(
        id="usr_requestverify",
        email="request-verify@example.com",
        hashed_password="hashed",
        display_name="Request Verify",
    )
    manager = UserManager(user_db=None)

    await manager.on_after_request_verify(user, "token-123")

    assert captured == {"user_id": "usr_requestverify", "token": "token-123"}


@pytest.mark.asyncio
async def test_register_sends_verification_email_and_verify_activates_user(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    email = f"feature2-register-{uuid4().hex[:8]}@example.com"
    captured: dict[str, str] = {}

    def fake_delay(user_id: str, token: str):
        captured["user_id"] = user_id
        captured["token"] = token
        return None

    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", fake_delay)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        register_response = await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "Password123",
                "display_name": "  Feature Two  ",
            },
        )

        assert register_response.status_code == 201
        assert captured["user_id"].startswith("usr_")
        assert captured["token"]

        verify_response = await client.post("/v1/auth/verify", json={"token": captured["token"]})
        assert verify_response.status_code in [200, 204]

    db = Database.get_db()
    user = await db["users"].find_one({"email": email})
    assert user is not None
    assert user["display_name"] == "Feature Two"
    assert user["is_verified"] is True
    assert user["is_active"] is True


@pytest.mark.asyncio
async def test_register_rejects_blank_display_name(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/register",
            json={
                "email": f"feature2-invalid-{uuid4().hex[:8]}@example.com",
                "password": "Password123",
                "display_name": "   ",
            },
        )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["field"] == "display_name"


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)
    email = f"feature2-duplicate-{uuid4().hex[:8]}@example.com"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first_response = await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "Password123",
                "display_name": "Feature Two",
            },
        )
        assert first_response.status_code == 201

        duplicate_response = await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": "Password123",
                "display_name": "Feature Two",
            },
        )
        assert duplicate_response.status_code == 409
        body = duplicate_response.json()
        assert body["error"]["code"] == "EMAIL_TAKEN"
