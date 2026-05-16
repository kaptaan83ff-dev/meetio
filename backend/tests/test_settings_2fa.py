import pytest
import fakeredis.aioredis
import pyotp
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from app.db import Database
from app.main import app
from app.redis import RedisManager
from app.lib.crypto import decrypt_field
from app.config import settings


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


@pytest.mark.asyncio
async def test_enable_and_disable_2fa(monkeypatch):
    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)
    monkeypatch.setattr(RedisManager, "client", fakeredis.aioredis.FakeRedis(decode_responses=True))

    email = f"feature2-settings-{uuid4().hex[:8]}@example.com"
    password = "Password123"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        register_response = await client.post(
            "/v1/auth/register",
            json={"email": email, "password": password, "display_name": "Settings User"},
        )
        assert register_response.status_code == 201

        await Database.get_db()["users"].update_one({"email": email}, {"$set": {"is_verified": True}})

        login_response = await client.post("/v1/auth/login", data={"username": email, "password": password})
        assert login_response.status_code == 200

        enable_response = await client.post("/v1/settings/2fa", json={"action": "enable"})
        assert enable_response.status_code == 200
        body = enable_response.json()
        assert body["data"]["totp_secret"]
        assert body["data"]["qr_code_url"].startswith("otpauth://totp/")

        user = await Database.get_db()["users"].find_one({"email": email})
        assert user is not None
        assert user["totp_enabled"] is False
        assert decrypt_field(user["totp_secret"], settings.SECRET_KEY) == body["data"]["totp_secret"]

        verify_response = await client.post(
            "/v1/auth/2fa/verify",
            json={"code": pyotp.TOTP(body["data"]["totp_secret"]).now()},
        )
        assert verify_response.status_code == 200
        verify_body = verify_response.json()
        assert verify_body["data"]["message"] == "2FA enabled."

        updated_user = await Database.get_db()["users"].find_one({"email": email})
        assert updated_user is not None
        assert updated_user["totp_enabled"] is True

        disable_response = await client.post("/v1/settings/2fa", json={"action": "disable"})
        assert disable_response.status_code == 200
        disable_body = disable_response.json()
        assert disable_body["data"]["message"] == "2FA disabled."

        disabled_user = await Database.get_db()["users"].find_one({"email": email})
        assert disabled_user is not None
        assert disabled_user["totp_enabled"] is False
        assert disabled_user["totp_secret"] is None
