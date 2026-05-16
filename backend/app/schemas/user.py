from __future__ import annotations

from typing import Optional

from fastapi_users import schemas
from pydantic import Field
from pydantic import field_validator


class UserRead(schemas.BaseUser[str]):
    display_name: str
    avatar_url: Optional[str] = None
    avatar_type: Optional[str] = None
    providers: list[str] = Field(default_factory=list)
    google_id: Optional[str] = None
    totp_enabled: bool = False
    timezone: str = "UTC"
    language: str = "en"
    theme: str = "system"
    email_notifications: dict = Field(default_factory=dict)
    deletion_requested_at: Optional[str] = None
    deletion_scheduled_at: Optional[str] = None
    schema_version: int = 1


class UserCreate(schemas.BaseUserCreate):
    display_name: str = Field(min_length=2, max_length=50)

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_display_name(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class UserUpdate(schemas.BaseUserUpdate):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    email_notifications: Optional[dict] = None
