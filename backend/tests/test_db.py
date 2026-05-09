import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

@pytest.mark.asyncio
async def test_mongodb_connection():
    """
    Test that we can connect to MongoDB and ping the database.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        # The ping command is cheap and does not require auth
        result = await client.admin.command("ping")
        assert result["ok"] == 1.0
    finally:
        client.close()

@pytest.mark.asyncio
async def test_collections_exist():
    """
    Test that all 16 collections exist in the database.
    Note: This requires migrations to have been run.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    try:
        collections = await db.list_collection_names()
        expected_collections = [
            "users", "sessions", "meetings", "participants", "guest_sessions",
            "recaps", "transcripts", "action_items", "conversations", "messages",
            "messenger_keys", "calendar_events", "gcal_tokens", "chat_messages",
            "notifications", "dead_letter_events"
        ]
        for coll in expected_collections:
            assert coll in collections, f"Collection {coll} missing"
    finally:
        client.close()

@pytest.mark.asyncio
async def test_indexes_exist():
    """
    Test that indexes exist for the users collection.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    try:
        indexes = await db.users.index_information()
        assert "email_1" in indexes
        assert "google_id_1" in indexes
    finally:
        client.close()
