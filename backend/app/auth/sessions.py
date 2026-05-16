from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Optional

from fastapi import Depends
from fastapi_users.authentication.strategy.db import AccessTokenDatabase
from motor.motor_asyncio import AsyncIOMotorCollection
from pydantic import BaseModel, ConfigDict, Field

from app.db import Database


def generate_session_id() -> str:
    from uuid import uuid4

    return f"sess_{uuid4().hex}"


class AccessToken(BaseModel):
    model_config = ConfigDict(extra="ignore")

    token: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    refresh_token_hash: Optional[str] = None
    device_info: dict[str, Any] = Field(default_factory=dict)
    is_revoked: bool = False
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    schema_version: int = 1


class MongoDBAccessTokenDatabase(AccessTokenDatabase[AccessToken]):
    def __init__(self, access_token_collection: AsyncIOMotorCollection):
        self.access_token_collection = access_token_collection

    async def get_by_token(
        self, token: str, max_age: Optional[datetime] = None
    ) -> Optional[AccessToken]:
        document = await self.access_token_collection.find_one({"token": token})
        if document is None:
            return None
        access_token = AccessToken(**document)
        if access_token.is_revoked:
            return None
        created_at = self._ensure_aware_utc(access_token.created_at)
        max_age_aware = self._ensure_aware_utc(max_age) if max_age is not None else None
        if max_age_aware is not None and created_at < max_age_aware:
            return None
        return access_token

    def _ensure_aware_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _coerce_access_token(self, access_token: AccessToken | dict[str, Any]) -> AccessToken:
        if isinstance(access_token, AccessToken):
            return access_token
        return AccessToken.model_validate(access_token)

    async def create(self, access_token: AccessToken | dict[str, Any]) -> AccessToken:
        access_token_model = self._coerce_access_token(access_token)
        document = access_token_model.model_dump(mode="python", by_alias=True)
        await self.access_token_collection.insert_one(document)
        return access_token_model

    async def update(self, access_token: AccessToken | dict[str, Any]) -> AccessToken:
        access_token_model = self._coerce_access_token(access_token)
        document = access_token_model.model_dump(mode="python", by_alias=True)
        await self.access_token_collection.replace_one(
            {"token": access_token_model.token}, document, upsert=True
        )
        return access_token_model

    async def delete(self, access_token: AccessToken) -> None:
        await self.access_token_collection.delete_one({"token": access_token.token})


async def get_access_token_db() -> AsyncGenerator[MongoDBAccessTokenDatabase, None]:
    sessions_collection = Database.get_db()["sessions"]
    yield MongoDBAccessTokenDatabase(sessions_collection)
