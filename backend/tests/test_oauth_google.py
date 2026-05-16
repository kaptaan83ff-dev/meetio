from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import Response
from httpx import ASGITransport, AsyncClient

from app.auth.manager import UserManager
from app.auth.oauth import generate_state_token, google_oauth_client
from app.db import Database
from app.main import app


def _is_local_mongo(uri: str) -> bool:
    return uri.startswith("mongodb://localhost") or uri.startswith("mongodb://127.0.0.1")


@pytest.mark.asyncio
async def test_google_authorize_redirects_to_provider(monkeypatch):
    from app.auth import oauth as oauth_module

    monkeypatch.setattr(oauth_module.settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(oauth_module.settings, "GOOGLE_CLIENT_SECRET", "client-secret")

    async def fake_get_authorization_url(redirect_uri, state, scopes):
        return f"https://accounts.google.com/auth?redirect_uri={redirect_uri}&state={state}"

    monkeypatch.setattr(google_oauth_client, "get_authorization_url", fake_get_authorization_url)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/auth/google/authorize", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"].startswith("https://accounts.google.com/auth?")


@pytest.mark.asyncio
async def test_google_callback_redirects_and_sets_cookie(monkeypatch):
    from app.auth import oauth as oauth_module

    app.dependency_overrides.clear()
    monkeypatch.setattr(oauth_module.settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(oauth_module.settings, "GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(oauth_module.settings, "GOOGLE_REDIRECT_URI", None)
    monkeypatch.setattr(oauth_module.settings, "FRONTEND_URL", "http://frontend.test")

    class FakeSessionsCollection:
        def __init__(self):
            self.updates = []

        async def update_one(self, query, update):
            self.updates.append((query, update))

    class FakeDb:
        def __init__(self):
            self.sessions = FakeSessionsCollection()

        def __getitem__(self, name):
            if name == "sessions":
                return self.sessions
            raise KeyError(name)

    monkeypatch.setattr("app.db.Database.get_db", lambda: FakeDb())

    async def fake_get_access_token(code, redirect_uri, code_verifier=None):
        return {
            "access_token": "google-access-token",
            "expires_at": 9999999999,
            "refresh_token": "google-refresh-token",
        }

    async def fake_fetch_google_user_info(access_token):
        return {
            "sub": "google-resource",
            "email": "person@example.com",
            "picture": "https://example.com/avatar.png",
        }

    monkeypatch.setattr(google_oauth_client, "get_access_token", fake_get_access_token)
    monkeypatch.setattr(oauth_module, "fetch_google_user_info", fake_fetch_google_user_info)

    class FakeManager:
        async def oauth_callback(
            self,
            oauth_name,
            access_token,
            account_id,
            account_email,
            expires_at=None,
            refresh_token=None,
            request=None,
            *,
            associate_by_email=False,
            is_verified_by_default=False,
        ):
            return SimpleNamespace(
                id="usr_google",
                email=account_email,
                is_active=True,
                providers=["email", "google"],
                avatar_url=None,
                avatar_type=None,
                google_id=account_id,
            )

        async def on_after_login(self, user, request=None, response=None):
            return None

    async def fake_login(strategy, user):
        response = Response(status_code=200)
        response.headers["set-cookie"] = "fastapiusersauth=session-token; Path=/; HttpOnly"
        return response

    app.dependency_overrides[oauth_module.get_user_manager] = lambda: FakeManager()
    app.dependency_overrides[oauth_module.get_database_strategy] = lambda: object()
    monkeypatch.setattr(oauth_module.auth_backend, "login", fake_login)

    state = generate_state_token({})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/v1/auth/google/callback",
            params={"code": "auth-code", "state": state},
            follow_redirects=False,
        )

    app.dependency_overrides.clear()

    assert response.status_code == 302
    assert response.headers["location"] == "http://frontend.test/dashboard"
    assert "set-cookie" in {key.lower() for key in response.headers.keys()}


@pytest.mark.asyncio
async def test_google_oauth_hook_updates_avatar_and_provider(monkeypatch):
    from app.auth.oauth import OAuthAccountInfo

    fake_user = SimpleNamespace(
        id="usr_google",
        providers=["email"],
        google_id=None,
        avatar_url=None,
        avatar_type=None,
    )

    class FakeUserDb:
        def __init__(self):
            self.calls = []

        async def update(self, user, updates):
            self.calls.append(updates)
            return SimpleNamespace(**{**user.__dict__, **updates})

    manager = UserManager(FakeUserDb())
    updated_user = await manager.on_after_oauth_account_add(
        fake_user,
        OAuthAccountInfo(
            oauth_name="google",
            account_id="google-resource",
            account_email="person@example.com",
            account_image_url="https://example.com/avatar.png",
        ),
    )

    assert "google" in updated_user.providers
    assert updated_user.google_id == "google-resource"
    assert updated_user.avatar_url == "https://example.com/avatar.png"
    assert updated_user.avatar_type == "google"


@pytest.mark.asyncio
async def test_google_oauth_callback_creates_user_with_required_profile_fields(monkeypatch):
    from app.models.user import User

    class FakeUserDb:
        def __init__(self):
            self.created = None

        async def get_by_oauth_account(self, oauth, account_id):
            return None

        async def get_by_email(self, email):
            return None

        async def create(self, create_dict):
            self.created = create_dict
            return User.model_validate(create_dict)

        async def add_oauth_account(self, user, create_dict):
            return user.model_copy(update={"providers": ["google"], "google_id": create_dict["account_id"]})

        async def update(self, user, update_dict):
            return user.model_copy(update=update_dict)

    fake_user_db = FakeUserDb()
    manager = UserManager(fake_user_db)

    async def fake_fetch_google_account_image_url(access_token):
        return None

    monkeypatch.setattr("app.auth.oauth.fetch_google_account_image_url", fake_fetch_google_account_image_url)

    user = await manager.oauth_callback(
        "google",
        "access-token",
        "google-resource",
        "person.name@example.com",
        associate_by_email=True,
        is_verified_by_default=True,
    )

    assert fake_user_db.created["display_name"] == "person name"
    assert fake_user_db.created["providers"] == []
    assert user.is_verified is True
    assert user.google_id == "google-resource"
    assert user.providers == ["google"]


@pytest.mark.asyncio
async def test_google_callback_uses_userinfo_endpoint_without_people_api(monkeypatch):
    from app.auth import oauth as oauth_module

    class FakeResponse:
        status_code = 200
        text = "{}"

        def json(self):
            return {
                "sub": "google-resource",
                "email": "person@example.com",
                "picture": "https://example.com/avatar.png",
            }

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url, headers=None):
            self.url = url
            self.headers = headers
            return FakeResponse()

    fake_client = FakeClient()
    monkeypatch.setattr(oauth_module.google_oauth_client, "get_httpx_client", lambda: fake_client)

    user_info = await oauth_module.fetch_google_user_info("access-token")

    assert fake_client.url == oauth_module.GOOGLE_USERINFO_ENDPOINT
    assert fake_client.headers["Authorization"] == "Bearer access-token"
    assert user_info["email"] == "person@example.com"
