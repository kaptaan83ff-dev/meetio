import pytest
import fakeredis.aioredis
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from app.db import Database
from app.main import app
from app.redis import RedisManager


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


async def _create_verified_user(client: AsyncClient, email: str, password: str) -> None:
    register_response = await client.post(
        "/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": "Logout User",
        },
    )
    assert register_response.status_code == 201
    await Database.get_db()["users"].update_one({"email": email}, {"$set": {"is_verified": True}})


@pytest.mark.asyncio
async def test_logout_revokes_session_and_clears_cookies(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    monkeypatch.setattr(RedisManager, "client", fakeredis.aioredis.FakeRedis(decode_responses=True))
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-logout-{uuid4().hex[:8]}@example.com"
    password = "Password123"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _create_verified_user(client, email, password)

        login_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200
        assert client.cookies.get("fastapiusersauth")
        assert client.cookies.get("refresh_token")

        logout_response = await client.post("/v1/auth/logout")
        assert logout_response.status_code == 204
        assert client.cookies.get("fastapiusersauth") is None
        assert client.cookies.get("refresh_token") is None
        set_cookie_headers = "\n".join(logout_response.headers.get_list("set-cookie"))
        assert "Max-Age=0" in set_cookie_headers

    user = await Database.get_db()["users"].find_one({"email": email})
    assert user is not None
    session = await Database.get_db()["sessions"].find_one({"user_id": user["id"]})
    assert session is not None
    assert session["is_revoked"] is True


@pytest.mark.asyncio
async def test_logout_requires_authentication():
    class FakeCollection:
        async def find_one(self, query):
            return None

        async def update_one(self, query, update):
            return None

        async def insert_one(self, document):
            return None

        async def replace_one(self, query, document, upsert=False):
            return None

    class FakeDb:
        def __init__(self):
            self.users = FakeCollection()
            self.sessions = FakeCollection()

        def __getitem__(self, name):
            if name == "users":
                return self.users
            if name == "sessions":
                return self.sessions
            raise KeyError(name)

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(Database, "get_db", lambda: FakeDb())

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/v1/auth/logout")

        assert response.status_code == 401
        assert response.json()["success"] is False
    finally:
        monkeypatch.undo()
