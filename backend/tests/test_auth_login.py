import pytest
import fakeredis.aioredis
import pyotp
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from app.db import Database
from app.main import app
from app.redis import RedisManager


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


async def _create_verified_user(client: AsyncClient, email: str, password: str, display_name: str) -> None:
    register_response = await client.post(
        "/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )
    assert register_response.status_code == 201
    user = await Database.get_db()["users"].find_one({"email": email})
    assert user is not None
    await Database.get_db()["users"].update_one({"email": email}, {"$set": {"is_verified": True}})


@pytest.mark.asyncio
async def test_login_without_two_factor_sets_session_cookie(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(RedisManager, "client", fake_redis)
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-login-{uuid4().hex[:8]}@example.com"
    password = "Password123"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _create_verified_user(client, email, password, "Login User")

        login_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
            headers={"User-Agent": "pytest-agent/1.0"},
        )

    assert login_response.status_code == 200
    body = login_response.json()
    assert body["success"] is True
    assert body["data"]["message"] == "Login successful."
    assert "set-cookie" in {key.lower() for key in login_response.headers.keys()}

    user = await Database.get_db()["users"].find_one({"email": email})
    assert user is not None
    session = await Database.get_db()["sessions"].find_one({"user_id": user["id"]})
    assert session is not None
    assert session["device_info"]["user_agent"] == "pytest-agent/1.0"


@pytest.mark.asyncio
async def test_login_rejects_bad_credentials_and_unverified_user(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(RedisManager, "client", fake_redis)
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-auth-errors-{uuid4().hex[:8]}@example.com"
    password = "Password123"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "display_name": "Auth Errors",
            },
        )

        bad_password_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": "WrongPassword123"},
        )
        assert bad_password_response.status_code == 400
        assert bad_password_response.json()["error"]["code"] == "LOGIN_BAD_CREDENTIALS"

        unverified_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert unverified_response.status_code == 400
        assert unverified_response.json()["error"]["code"] == "LOGIN_USER_NOT_VERIFIED"


@pytest.mark.asyncio
async def test_login_requires_two_factor_and_verify_sets_cookies(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(RedisManager, "client", fake_redis)
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-2fa-{uuid4().hex[:8]}@example.com"
    password = "Password123"
    secret = pyotp.random_base32()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _create_verified_user(client, email, password, "Two Factor User")
        await Database.get_db()["users"].update_one(
            {"email": email},
            {"$set": {"totp_enabled": True, "totp_secret": secret}},
        )

        login_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200
        login_body = login_response.json()
        assert login_body["success"] is True
        assert login_body["data"]["requires_2fa"] is True
        assert "totp_session_id" in login_body["data"]
        assert "set-cookie" not in {key.lower() for key in login_response.headers.keys()}

        totp_session_id = login_body["data"]["totp_session_id"]

        verify_response = await client.post(
            "/v1/auth/2fa/verify",
            json={"totp_session_id": totp_session_id, "code": pyotp.TOTP(secret).now()},
        )
        assert verify_response.status_code == 200
        verify_body = verify_response.json()
        assert verify_body["success"] is True
        assert verify_body["data"]["message"] == "Two-factor verified."
        assert "set-cookie" in {key.lower() for key in verify_response.headers.keys()}


@pytest.mark.asyncio
async def test_login_two_factor_wrong_code_locks_after_six_attempts(monkeypatch):
    from app.config import settings

    if not _is_local_mongo(settings.MONGODB_URI):
        pytest.skip("MongoDB integration tests require local MongoDB (mongodb://localhost).")

    fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(RedisManager, "client", fake_redis)
    monkeypatch.setattr("app.auth.manager.send_verification_email.delay", lambda *args, **kwargs: None)

    email = f"feature2-lock-{uuid4().hex[:8]}@example.com"
    password = "Password123"
    secret = pyotp.random_base32()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _create_verified_user(client, email, password, "Lockout User")
        await Database.get_db()["users"].update_one(
            {"email": email},
            {"$set": {"totp_enabled": True, "totp_secret": secret}},
        )

        login_response = await client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
        )
        totp_session_id = login_response.json()["data"]["totp_session_id"]

        for attempt in range(5):
            response = await client.post(
                "/v1/auth/2fa/verify",
                json={"totp_session_id": totp_session_id, "code": "000000"},
            )
            assert response.status_code == 400
            assert response.json()["error"]["code"] == "INVALID_OTP"

        locked_response = await client.post(
            "/v1/auth/2fa/verify",
            json={"totp_session_id": totp_session_id, "code": "000000"},
        )
        assert locked_response.status_code == 429
        assert locked_response.json()["error"]["code"] == "OTP_LOCKED"


@pytest.mark.asyncio
async def test_on_after_login_anonymises_ip_and_updates_session(monkeypatch):
    from types import SimpleNamespace
    from app.auth.manager import UserManager

    class FakeSessionsCollection:
        def __init__(self):
            self.updates = []
            self.sessions = [{"token": "session-token"}]

        async def find_one(self, query):
            for session in self.sessions:
                if session.get("token") == query.get("token"):
                    return session
            return None

        async def update_one(self, query, update):
            self.updates.append((query, update))

    class FakeDb:
        def __init__(self):
            self.sessions = FakeSessionsCollection()

        def __getitem__(self, name):
            if name == "sessions":
                return self.sessions
            raise KeyError(name)

    fake_db = FakeDb()
    monkeypatch.setattr(Database, "get_db", lambda: fake_db)

    class FakeHeaders:
        def __init__(self, headers):
            self._headers = headers

        def getlist(self, name):
            return self._headers.get(name, [])

        def get(self, name, default=None):
            values = self._headers.get(name)
            return values[0] if values else default

    fake_response = SimpleNamespace(
        headers=FakeHeaders(
            {
                "set-cookie": [
                    "fastapiusersauth=session-token; Path=/; HttpOnly",
                ]
            }
        )
    )
    fake_request = SimpleNamespace(
        headers={"user-agent": "Mozilla/5.0"},
        client=SimpleNamespace(host="103.21.44.55"),
    )
    user_manager = UserManager(object())

    await user_manager.on_after_login(
        SimpleNamespace(id="usr_test", email="user@example.com"),
        fake_request,
        fake_response,
    )

    assert fake_db.sessions.updates
    query, update = fake_db.sessions.updates[0]
    assert query == {"token": "session-token"}
    assert update["$set"]["device_info"]["ip_anonymised"] == "103.21.44.x"
    assert update["$set"]["device_info"]["city"] is None
    assert update["$set"]["device_info"]["country"] is None
