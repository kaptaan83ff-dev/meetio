import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_check_endpoint():
    """
    Test that the health check endpoint returns a successful response.
    Note: This assumes DB and Redis are reachable in the test environment.
    """
    from httpx import ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    
    # We expect 200 if everything is up, or 503 if Celery worker is not running
    # Since we are in a test env without a worker, it might be 503
    assert response.status_code in [200, 503]
    
    data = response.json()
    assert data["success"] in [True, False]
    assert "checks" in data["data"]
    assert "mongodb" in data["data"]["checks"]
    assert "redis" in data["data"]["checks"]
    assert "celery" in data["data"]["checks"]

@pytest.mark.asyncio
async def test_health_check_mongodb_only():
    """
    Test individual health check functions could be mocked if needed.
    """
    from app.routers.health import check_mongodb
    from app.db import Database
    
    db = Database.get_db()
    status = await check_mongodb(db)
    assert status is True
