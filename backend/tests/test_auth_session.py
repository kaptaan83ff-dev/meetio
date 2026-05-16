import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_session_returns_anonymous_state_without_cookies():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        response = await client.get("/v1/auth/session")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == {"authenticated": False, "user": None}
