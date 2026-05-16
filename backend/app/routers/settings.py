from __future__ import annotations

import pyotp
from fastapi import APIRouter, Depends, Request

from app.auth.backend import fastapi_users
from app.config import settings
from app.db import Database
from app.lib.audit import audit_event
from app.lib.crypto import decrypt_field, encrypt_field
from app.routers._envelope import ok
from app.schemas.settings import TwoFactorActionRequest


router = APIRouter(prefix="/settings", tags=["settings"])

current_user = fastapi_users.current_user(active=True)


@router.post("/2fa")
async def manage_two_factor(request: Request, payload: TwoFactorActionRequest, user=Depends(current_user)):
    users_collection = Database.get_db()["users"]

    if payload.action == "enable":
        secret = pyotp.random_base32()
        encrypted_secret = encrypt_field(secret, settings.SECRET_KEY)
        await users_collection.update_one(
            {"id": str(user.id)},
            {"$set": {"totp_secret": encrypted_secret, "totp_enabled": False}},
        )
        audit_event("settings.2fa", outcome="setup_started", request=request, user_id=str(user.id), email=user.email)
        return ok(
            data={
                "totp_secret": secret,
                "qr_code_url": pyotp.TOTP(secret).provisioning_uri(user.email, issuer_name="MeetIO"),
                "message": "Scan the QR code in your authenticator app, then verify with a code.",
            },
            request=request,
        )

    await users_collection.update_one(
        {"id": str(user.id)},
        {"$set": {"totp_enabled": False, "totp_secret": None}},
    )
    audit_event("settings.2fa", outcome="disabled", request=request, user_id=str(user.id), email=user.email)
    return ok(data={"message": "2FA disabled."}, request=request)
