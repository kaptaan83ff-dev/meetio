from redis.asyncio import Redis, from_url
from app.config import settings

class RedisManager:
    client: Redis = None

    @classmethod
    def get_client(cls) -> Redis:
        if cls.client is None:
            cls.client = from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
        return cls.client

    @classmethod
    async def ping(cls):
        client = cls.get_client()
        await client.ping()

    @classmethod
    async def close(cls):
        if cls.client:
            await cls.client.aclose()
            cls.client = None

async def get_redis() -> Redis:
    """
    FastAPI dependency that provides the Redis client.
    """
    return RedisManager.get_client()

# No global redis_client instance at module level to avoid event loop issues.
# Use get_redis() or RedisManager.get_client() instead.
