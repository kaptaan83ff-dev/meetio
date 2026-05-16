import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_check_endpoint(monkeypatch):
    from httpx import ASGITransport
    from app.db import get_db
    from app.redis import get_redis
    from app.routers import health as health_router

    async def fake_check_mongodb(db):
        return True

    async def fake_check_redis(redis):
        return True

    async def fake_check_celery():
        return True

    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[get_redis] = lambda: object()
    monkeypatch.setattr(health_router, "check_mongodb", fake_check_mongodb)
    monkeypatch.setattr(health_router, "check_redis", fake_check_redis)
    monkeypatch.setattr(health_router, "check_celery", fake_check_celery)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")

    app.dependency_overrides.clear()

    assert response.status_code == 200

    data = response.json()
    assert set(data.keys()) == {"success", "data", "error", "meta"}
    assert isinstance(data["meta"].get("timestamp"), str)
    assert isinstance(data["meta"].get("request_id"), str)
    assert "checks" in data["data"]
    assert set(data["data"]["checks"].keys()) == {"mongodb", "redis", "celery"}
    assert data["success"] is True
    assert data["error"] is None
    assert data["data"]["status"] == "ok"

@pytest.mark.asyncio
async def test_health_check_mongodb_only():
    from app.routers.health import check_mongodb

    class FakeDb:
        async def command(self, _name):
            return {"ok": 1.0}

    status = await check_mongodb(FakeDb())
    assert status is True
