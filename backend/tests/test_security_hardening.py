import pytest
from httpx import ASGITransport, AsyncClient

from app.lib import rate_limit
from app.lib.rate_limit import RouteRateLimitRule, reset_in_memory_rate_limits
from app.main import app
from app.redis import RedisManager


@pytest.mark.asyncio
async def test_security_headers_are_applied_to_api_responses():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/stubs")

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert response.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=()"


@pytest.mark.asyncio
async def test_auth_routes_return_no_store_cache_header():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/auth/session")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.asyncio
async def test_auth_route_rate_limit_returns_enveloped_429(monkeypatch):
    reset_in_memory_rate_limits()
    monkeypatch.setattr(
        rate_limit,
        "AUTH_RATE_LIMIT_RULES",
        (RouteRateLimitRule("POST", "/v1/auth/refresh", 1, 60),),
    )
    monkeypatch.setattr(RedisManager, "get_client", staticmethod(lambda: (_ for _ in ()).throw(ConnectionError())))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first_response = await client.post("/v1/auth/refresh")
        limited_response = await client.post("/v1/auth/refresh")

    assert first_response.status_code == 401
    assert limited_response.status_code == 429
    body = limited_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert limited_response.headers["Retry-After"]
    assert limited_response.headers["X-RateLimit-Limit"] == "1"


@pytest.mark.asyncio
async def test_cors_preflight_allows_configured_frontend_origin():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/v1/auth/login",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
