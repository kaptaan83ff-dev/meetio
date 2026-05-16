import asyncio
from typing import Any

from fastapi_users.db import BaseUserDatabase
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.user import User

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


class MongoDBUserDatabase(BaseUserDatabase[User, str]):
    def __init__(self, users_collection):
        self.users_collection = users_collection

    @staticmethod
    def _to_user(document: dict[str, Any] | None) -> User | None:
        if document is None:
            return None
        return User.model_validate(document)

    async def get(self, id: str) -> User | None:
        return self._to_user(await self.users_collection.find_one({"id": id}))

    async def get_by_email(self, email: str) -> User | None:
        return self._to_user(await self.users_collection.find_one({"email": email}))

    async def get_by_oauth_account(self, oauth: str, account_id: str) -> User | None:
        query: dict[str, Any] = {"providers": oauth}
        if oauth == "google":
            query["google_id"] = account_id
        else:
            query[f"{oauth}_id"] = account_id
        return self._to_user(await self.users_collection.find_one(query))

    async def create(self, create_dict: dict[str, Any]) -> User:
        user = User.model_validate(create_dict)
        document = user.model_dump(mode="python")
        await self.users_collection.insert_one(document)
        return user

    async def update(self, user: User, update_dict: dict[str, Any]) -> User:
        updated_user = user.model_copy(update=update_dict)
        await self.users_collection.replace_one(
            {"id": str(user.id)},
            updated_user.model_dump(mode="python"),
        )
        return updated_user

    async def delete(self, user: User) -> None:
        await self.users_collection.delete_one({"id": str(user.id)})

    async def add_oauth_account(self, user: User, create_dict: dict[str, Any]) -> User:
        provider = str(create_dict.get("oauth_name") or create_dict.get("provider") or "")
        account_id = str(create_dict.get("account_id") or create_dict.get("id") or "")
        updates: dict[str, Any] = {}
        providers = list(user.providers or [])
        if provider and provider not in providers:
            providers.append(provider)
            updates["providers"] = providers
        if provider == "google" and account_id:
            updates["google_id"] = account_id
        if updates:
            updated_user = user.model_copy(update=updates)
            await self.users_collection.replace_one(
                {"id": str(user.id)},
                updated_user.model_dump(mode="python"),
            )
            return updated_user
        return user

    async def update_oauth_account(
        self, user: User, oauth_account: Any, update_dict: dict[str, Any]
    ) -> User:
        updates = dict(update_dict)
        if getattr(oauth_account, "oauth_name", None) == "google" and getattr(oauth_account, "account_id", None):
            updates.setdefault("google_id", oauth_account.account_id)
        updated_user = user.model_copy(update=updates)
        await self.users_collection.replace_one(
            {"id": str(user.id)},
            updated_user.model_dump(mode="python"),
        )
        return updated_user


async def get_user_db():
    users_collection = Database.get_db()["users"]
    yield MongoDBUserDatabase(users_collection)

# No global db instance at module level to avoid event loop issues.
# Use get_db() or Database.get_db() instead.
