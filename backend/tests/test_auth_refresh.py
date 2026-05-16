from datetime import datetime, timedelta, timezone
from uuid import uuid4

import fakeredis.aioredis
import pytest
from httpx import ASGITransport, AsyncClient

from app.db import Database
from app.main import app
from app.redis import RedisManager


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


@pytest.mark.asyncio
async def test_login_sets_refresh_cookie_and_refresh_rotates(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr(RedisManager, "client", fakeredis.aioredis.FakeRedis(decode_responses=True))
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-refresh-{uuid4().hex[:8]}@example.com"
    password = "Password123"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        register_response = await client.post(
            "/v1/auth/register",
            json={"email": email, "password": password, "display_name": "Refresh User"},
        )
        assert register_response.status_code == 201

        await Database.get_db()["users"].update_one({"email": email}, {"$set": {"is_verified": True}})

        login_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200
        assert client.cookies.get("refresh_token")

        old_refresh_token = client.cookies.get("refresh_token")
        refresh_response = await client.post("/v1/auth/refresh")
        assert refresh_response.status_code == 200
        assert refresh_response.json()["data"]["message"] == "Token refreshed."

        new_refresh_token = client.cookies.get("refresh_token")
        assert new_refresh_token and new_refresh_token != old_refresh_token

        client.cookies.set("refresh_token", old_refresh_token, domain="test", path="/")
        stale_refresh_response = await client.post("/v1/auth/refresh")
        assert stale_refresh_response.status_code == 401
        assert stale_refresh_response.json()["error"]["code"] in {"TOKEN_EXPIRED", "TOKEN_INVALID"}


@pytest.mark.asyncio
async def test_refresh_rejects_expired_token(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr(RedisManager, "client", fakeredis.aioredis.FakeRedis(decode_responses=True))
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-refresh-expired-{uuid4().hex[:8]}@example.com"
    password = "Password123"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        await client.post(
            "/v1/auth/register",
            json={"email": email, "password": password, "display_name": "Expired Refresh"},
        )
        await Database.get_db()["users"].update_one({"email": email}, {"$set": {"is_verified": True}})

        await client.post("/v1/auth/login", data={"username": email, "password": password})
        refresh_token = client.cookies.get("refresh_token")
        assert refresh_token

        user = await Database.get_db()["users"].find_one({"email": email})
        assert user is not None
        await Database.get_db()["sessions"].update_one(
            {"user_id": user["id"], "refresh_token_hash": {"$exists": True}},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(days=1)}},
        )

        expired_response = await client.post("/v1/auth/refresh")
        assert expired_response.status_code == 401
        assert expired_response.json()["error"]["code"] == "TOKEN_EXPIRED"


@pytest.mark.asyncio
async def test_refresh_rejects_missing_cookie():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        response = await client.post("/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_INVALID"
