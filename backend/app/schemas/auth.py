from __future__ import annotations

from pydantic import BaseModel, Field


class Login2FARequest(BaseModel):
    totp_session_id: str | None = None
    code: str = Field(min_length=6, max_length=6)
