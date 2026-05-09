import pytest
from app.db import Database
from app.redis import RedisManager
import asyncio

@pytest.fixture(autouse=True)
async def reset_singletons():
    """
    Resets the Database and RedisManager singletons after each test.
    This prevents 'RuntimeError: Event loop is closed' because pytest-asyncio
    creates a new event loop for each test function by default, and singletons
    might cache clients bound to closed loops.
    """
    yield
    # Close and reset after the test finishes
    Database.close()
    await RedisManager.close()
