from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, InvalidID
from fastapi_users import exceptions
from fastapi_users.exceptions import InvalidPasswordException
from fastapi_users.jwt import generate_jwt

from app.config import settings
from app.db import Database, get_user_db
from app.lib.audit import audit_event
from app.models.user import User
from app.tasks.notifications import send_password_reset_email, send_verification_email


logger = logging.getLogger(__name__)


def anonymize_ip(address: str | None) -> str | None:
    if not address:
        return None
    parts = address.split(".")
    if len(parts) != 4:
        return address
    return ".".join(parts[:3] + ["x"])


def extract_cookie_value(set_cookie_headers: list[str], cookie_name: str) -> str | None:
    from http.cookies import SimpleCookie

    for header in set_cookie_headers:
        cookie = SimpleCookie()
        cookie.load(header)
        if cookie_name in cookie:
            return cookie[cookie_name].value
    return None


def display_name_from_email(email: str) -> str:
    local_part = email.split("@", 1)[0]
    display_name = re.sub(r"[\W_]+", " ", local_part).strip()
    if len(display_name) < 2:
        return "MeetIO User"
    return display_name[:50]


class UserManager(BaseUserManager[User, str]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY
    _password_min_length = 8
    _password_uppercase_pattern = re.compile(r"[A-Z]")
    _password_number_pattern = re.compile(r"\d")
    _password_symbol_pattern = re.compile(r"[^A-Za-z0-9]")

    def parse_id(self, value: Any) -> str:
        if not isinstance(value, str) or not value.startswith("usr_"):
            raise InvalidID()
        return value

    async def validate_password(self, password: str, user: User) -> None:
        if len(password) < self._password_min_length:
            raise InvalidPasswordException("Password must be at least 8 characters long.")
        if not self._password_uppercase_pattern.search(password):
            raise InvalidPasswordException("Password must include at least one uppercase letter.")
        if not self._password_number_pattern.search(password):
            raise InvalidPasswordException("Password must include at least one number.")
        if not self._password_symbol_pattern.search(password):
            raise InvalidPasswordException("Password must include at least one special character.")

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        audit_event("auth.register", outcome="success", request=request, user_id=str(user.id), email=user.email)
        try:
            token_data = {
                "sub": str(user.id),
                "email": user.email,
                "aud": self.verification_token_audience,
            }
            token = generate_jwt(
                token_data,
                self.verification_token_secret,
                self.verification_token_lifetime_seconds,
            )
            send_verification_email.delay(str(user.id), token)
        except Exception:
            logger.exception("Failed to enqueue verification email for user %s", user.id)

    async def on_after_request_verify(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        audit_event("auth.verify_email.request", outcome="requested", request=request, user_id=str(user.id), email=user.email)
        try:
            send_verification_email.delay(str(user.id), token)
        except Exception:
            logger.exception("Failed to enqueue requested verification email for user %s", user.id)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ) -> None:
        audit_event("auth.password_reset.request", outcome="requested", request=request, user_id=str(user.id), email=user.email)
        try:
            send_password_reset_email.delay(str(user.id), token)
        except Exception:
            logger.exception("Failed to enqueue password reset email for user %s", user.id)

    async def on_after_reset_password(
        self, user: User, request: Request | None = None
    ) -> None:
        audit_event("auth.password_reset.complete", outcome="success", request=request, user_id=str(user.id), email=user.email)
        sessions_collection = Database.get_db()["sessions"]
        await sessions_collection.update_many(
            {"user_id": str(user.id)},
            {"$set": {"is_revoked": True}},
        )

    async def on_after_oauth_account_add(
        self, user: User, oauth_account: Any, request: Request | None = None
    ) -> User:
        providers = list(user.providers or [])
        if oauth_account.oauth_name not in providers:
            providers.append(oauth_account.oauth_name)

        updates: dict[str, Any] = {
            "providers": providers,
            "google_id": oauth_account.account_id if oauth_account.oauth_name == "google" else user.google_id,
        }

        if oauth_account.oauth_name == "google" and oauth_account.account_image_url:
            if user.avatar_url is None or user.avatar_type == "google":
                updates["avatar_url"] = oauth_account.account_image_url
                updates["avatar_type"] = "google"

        return await self.user_db.update(user, updates)

    async def _apply_google_account_hook(
        self,
        user: User,
        oauth_name: str,
        account_id: str,
        account_email: str,
        access_token: str,
        request: Request | None = None,
    ) -> User:
        if oauth_name != "google":
            return user

        try:
            from app.auth.oauth import OAuthAccountInfo, fetch_google_account_image_url

            account_image_url = None
            if request is not None:
                account_image_url = getattr(request.state, "google_account_image_url", None)

            oauth_account = OAuthAccountInfo(
                oauth_name=oauth_name,
                account_id=account_id,
                account_email=account_email,
                account_image_url=account_image_url or await fetch_google_account_image_url(access_token),
            )
            return await self.on_after_oauth_account_add(user, oauth_account, request)
        except Exception:
            logger.exception("Failed to apply Google OAuth account hook for user %s", user.id)
            return user

    async def on_after_login(
        self, user: User, request: Request | None = None, response=None
    ) -> None:
        if request is None or response is None:
            return None

        try:
            set_cookie_headers = response.headers.getlist("set-cookie")
        except Exception:
            header_value = response.headers.get("set-cookie")
            set_cookie_headers = [header_value] if header_value else []

        session_token = extract_cookie_value(set_cookie_headers, "fastapiusersauth")
        if not session_token:
            return None

        audit_event("auth.login", outcome="success", request=request, user_id=str(user.id), email=user.email)

        sessions_collection = Database.get_db()["sessions"]
        existing_session = await sessions_collection.find_one({"token": session_token})
        if existing_session is None:
            return None

        device_info = {
            "user_agent": request.headers.get("user-agent"),
            "ip_anonymised": anonymize_ip(getattr(request.client, "host", None)),
            "city": None,
            "country": None,
        }

        await Database.get_db()["sessions"].update_one(
            {"token": session_token},
            {
                "$set": {
                    "device_info": device_info,
                    "last_used_at": datetime.now(timezone.utc),
                }
            },
        )

    async def oauth_callback(
        self,
        oauth_name: str,
        access_token: str,
        account_id: str,
        account_email: str,
        expires_at: int | None = None,
        refresh_token: str | None = None,
        request: Request | None = None,
        *,
        associate_by_email: bool = False,
        is_verified_by_default: bool = False,
    ) -> User:
        oauth_account_dict = {
            "oauth_name": oauth_name,
            "access_token": access_token,
            "account_id": account_id,
            "account_email": account_email,
            "expires_at": expires_at,
            "refresh_token": refresh_token,
        }

        try:
            user = await self.user_db.get_by_oauth_account(oauth_name, account_id)
        except exceptions.UserNotExists:
            user = None

        if user is None:
            try:
                user = await self.user_db.get_by_email(account_email)
            except exceptions.UserNotExists:
                user = None

            if user is not None:
                if not associate_by_email:
                    raise exceptions.UserAlreadyExists()
                user = await self.user_db.add_oauth_account(user, oauth_account_dict)
                if is_verified_by_default and not user.is_verified:
                    user = await self.user_db.update(user, {"is_verified": True})
            else:
                password = self.password_helper.generate()
                user = await self.user_db.create(
                    {
                        "email": account_email,
                        "hashed_password": self.password_helper.hash(password),
                        "is_verified": is_verified_by_default,
                        "display_name": display_name_from_email(account_email),
                        "providers": [],
                    }
                )
                user = await self.user_db.add_oauth_account(user, oauth_account_dict)

        return await self._apply_google_account_hook(
            user, oauth_name, account_id, account_email, access_token, request
        )

    async def oauth_associate_callback(
        self,
        user: User,
        oauth_name: str,
        access_token: str,
        account_id: str,
        account_email: str,
        expires_at: int | None = None,
        refresh_token: str | None = None,
        request: Request | None = None,
    ) -> User:
        user = await super().oauth_associate_callback(
            user,
            oauth_name,
            access_token,
            account_id,
            account_email,
            expires_at,
            refresh_token,
            request,
        )
        return await self._apply_google_account_hook(
            user, oauth_name, account_id, account_email, access_token, request
        )

async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)
