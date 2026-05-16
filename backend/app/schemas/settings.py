from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class TwoFactorActionRequest(BaseModel):
    action: Literal["enable", "disable"]
