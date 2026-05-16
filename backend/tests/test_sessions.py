from datetime import datetime, timezone

import pytest

from app.auth.sessions import AccessToken, MongoDBAccessTokenDatabase


class FakeAccessTokenCollection:
    def __init__(self, document=None):
        self.document = document
        self.inserted_document = None
        self.replaced_filter = None
        self.replaced_document = None

    async def find_one(self, filter_):
        return self.document

    async def insert_one(self, document):
        self.inserted_document = document

    async def replace_one(self, filter_, document, upsert=False):
        self.replaced_filter = filter_
        self.replaced_document = document
        self.replaced_upsert = upsert


@pytest.mark.asyncio
async def test_access_token_database_create_accepts_dict():
    collection = FakeAccessTokenCollection()
    database = MongoDBAccessTokenDatabase(collection)
    created_at = datetime.now(timezone.utc)

    access_token = await database.create(
        {
            "token": "token-123",
            "user_id": "usr_123",
            "created_at": created_at,
        }
    )

    assert isinstance(access_token, AccessToken)
    assert access_token.token == "token-123"
    assert collection.inserted_document["token"] == "token-123"
    assert collection.inserted_document["user_id"] == "usr_123"


@pytest.mark.asyncio
async def test_access_token_database_update_accepts_dict():
    collection = FakeAccessTokenCollection()
    database = MongoDBAccessTokenDatabase(collection)

    access_token = await database.update({"token": "token-456", "user_id": "usr_456"})

    assert isinstance(access_token, AccessToken)
    assert collection.replaced_filter == {"token": "token-456"}
    assert collection.replaced_document["user_id"] == "usr_456"
    assert collection.replaced_upsert is True


@pytest.mark.asyncio
async def test_access_token_database_compares_naive_mongo_datetime_to_aware_max_age():
    created_at = datetime(2026, 5, 16, 12, 0, 0)
    collection = FakeAccessTokenCollection(
        {
            "token": "token-789",
            "user_id": "usr_789",
            "created_at": created_at,
        }
    )
    database = MongoDBAccessTokenDatabase(collection)

    access_token = await database.get_by_token(
        "token-789",
        max_age=datetime(2026, 5, 16, 11, 0, 0, tzinfo=timezone.utc),
    )

    assert access_token is not None
    assert access_token.token == "token-789"
