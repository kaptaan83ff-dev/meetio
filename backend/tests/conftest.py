import sys
from pathlib import Path

import pytest

# Ensure tests import the local `backend/app` package from THIS workspace,
# even if another editable install exists on the machine.
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.db import Database
from app.lib.rate_limit import reset_in_memory_rate_limits
from app.redis import RedisManager

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
    reset_in_memory_rate_limits()
    Database.close()
    await RedisManager.close()
