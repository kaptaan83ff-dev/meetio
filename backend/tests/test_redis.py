import pytest
import asyncio
import fakeredis.aioredis

@pytest.mark.asyncio
async def test_redis_ping():
    """
    Test that we can ping Redis.
    Uses fakeredis to avoid network dependencies.
    """
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    pong = await redis_client.ping()
    assert pong is True

@pytest.mark.asyncio
async def test_redis_set_get():
    """
    Test basic SET and GET operations with decode_responses=True.
    """
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    await redis_client.set("test_key", "test_value", ex=10)
    value = await redis_client.get("test_key")
    assert value == "test_value"
    await redis_client.delete("test_key")

@pytest.mark.asyncio
async def test_redis_pub_sub():
    """
    Test Redis Pub/Sub round-trip.
    """
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = "ws:user:test_user"
    
    await pubsub.subscribe(channel)
    
    # Publish a message
    message_data = '{"type": "test"}'
    await redis_client.publish(channel, message_data)
    
    # Wait for the message
    message = None
    for _ in range(10):  # Retry for ~1 second
        msg = await pubsub.get_message(ignore_subscribe_messages=True)
        if msg:
            message = msg
            break
        await asyncio.sleep(0.1)
    
    assert message is not None
    assert message["data"] == message_data
    
    await pubsub.unsubscribe(channel)
    await pubsub.aclose()
