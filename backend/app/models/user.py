from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def generate_user_id() -> str:
    return f"usr_{uuid4().hex}"


def default_email_notifications() -> dict:
    return {
        "meeting_recap_ready": True,
        "action_item_assigned": True,
        "action_item_due_reminder": True,
        "meeting_invite": True,
        "gcal_sync_failed": True,
    }

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=generate_user_id)
    email: EmailStr
    hashed_password: str
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = False
    display_name: str
    avatar_url: Optional[str] = None
    avatar_type: Optional[str] = None
    providers: List[str] = Field(default_factory=lambda: ["email"])
    google_id: Optional[str] = None
    totp_enabled: bool = False
    totp_secret: Optional[str] = None
    timezone: str = "UTC"
    language: str = "en"
    theme: str = "system"
    email_notifications: dict = Field(default_factory=default_email_notifications)
    deletion_requested_at: Optional[str] = None
    deletion_scheduled_at: Optional[str] = None
    schema_version: int = 1
