from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import asyncio

class Database:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        if cls.client is None:
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_URI, 
                maxPoolSize=10,
                # Explicitly pass the current event loop to avoid 'closed loop' issues in tests
                io_loop=asyncio.get_event_loop()
            )
        return cls.client

    @classmethod
    def get_db(cls):
        if cls.db is None:
            cls.db = cls.get_client()[settings.MONGODB_DB_NAME]
        return cls.db

    @classmethod
    async def ping(cls):
        client = cls.get_client()
        await client.admin.command('ping')

    @classmethod
    def close(cls):
        if cls.client:
            cls.client.close()
            cls.client = None
            cls.db = None

async def get_db():
    """
    FastAPI dependency that provides the database instance.
    """
    return Database.get_db()

# No global db instance at module level to avoid event loop issues.
# Use get_db() or Database.get_db() instead.
