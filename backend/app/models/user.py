from datetime import datetime
from typing import List, Optional
from fastapi_users.db import MotorBaseUser
from pydantic import Field

class User(MotorBaseUser[str]):
    display_name: str
    avatar_url: Optional[str] = None
    avatar_type: Optional[str] = None
    providers: List[str] = []
    google_id: Optional[str] = None
    totp_enabled: bool = False
    totp_secret: Optional[str] = None
    timezone: str = "UTC"
    language: str = "en"
    theme: str = "system"
    email_notifications: dict = Field(default_factory=lambda: {
        "marketing": False,
        "security": True,
        "updates": True,
        "meeting_reminders": True
    })
    deletion_requested_at: Optional[datetime] = None
    deletion_scheduled_at: Optional[datetime] = None
    schema_version: int = 1
