from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users import exceptions
from pydantic import BaseModel, EmailStr

from app.auth.backend import auth_backend, fastapi_users, get_database_strategy
from app.auth.manager import UserManager, extract_cookie_value, get_user_manager
from app.auth.sessions import get_access_token_db
from app.config import settings
from app.db import Database, get_user_db
from app.lib.audit import audit_event
from app.lib.crypto import decrypt_field
from app.lib.rate_limit import limiter
from app.redis import RedisManager
from app.schemas.auth import Login2FARequest
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.routers._envelope import ok, json_error


class VerifyEmailRequest(BaseModel):
    token: str


class RequestVerifyEmailRequest(BaseModel):
    email: EmailStr


def _copy_set_cookie_headers(source: Response, destination: Response) -> None:
    try:
        cookie_headers = source.headers.getlist("set-cookie")
    except Exception:
        header_value = source.headers.get("set-cookie")
        cookie_headers = [header_value] if header_value else []
    for cookie_header in cookie_headers:
        destination.headers.append("set-cookie", cookie_header)


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _refresh_cookie_max_age() -> int:
    return settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=_refresh_cookie_max_age(),
        secure=settings.APP_ENV != "development",
        httponly=True,
        samesite="lax",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.set_cookie(
        key="refresh_token",
        value="",
        max_age=0,
        secure=settings.APP_ENV != "development",
        httponly=True,
        samesite="lax",
    )


def _serialize_user(user) -> dict:
    return UserRead.model_validate(user.model_dump()).model_dump(mode="json")


async def _attach_refresh_session(
    *,
    user,
    request: Request,
    source_response: Response,
    destination_response: Response,
) -> None:
    try:
        cookie_headers = source_response.headers.getlist("set-cookie")
    except Exception:
        header_value = source_response.headers.get("set-cookie")
        cookie_headers = [header_value] if header_value else []

    session_token = None
    for cookie_header in cookie_headers:
        session_token = extract_cookie_value([cookie_header], "fastapiusersauth")
        if session_token:
            break

    if not session_token:
        _copy_set_cookie_headers(source_response, destination_response)
        return

    refresh_token = secrets.token_urlsafe(48)
    refresh_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    sessions_collection = Database.get_db()["sessions"]
    await sessions_collection.update_one(
        {"token": session_token, "user_id": str(user.id)},
        {
            "$set": {
                "refresh_token_hash": _hash_refresh_token(refresh_token),
                "expires_at": refresh_expires_at,
                "last_used_at": datetime.now(timezone.utc),
                "is_revoked": False,
            }
        },
    )

    _copy_set_cookie_headers(source_response, destination_response)
    _set_refresh_cookie(destination_response, refresh_token)


async def _build_login_response_from_refresh_cookie(
    *,
    request: Request,
) -> tuple[object, Response] | None:
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        return None

    user_manager = None
    async for user_db in get_user_db():
        user_manager = UserManager(user_db)
        break

    access_token_db = None
    async for db in get_access_token_db():
        access_token_db = db
        break

    if user_manager is None or access_token_db is None:
        return None

    refresh_token_hash = _hash_refresh_token(refresh_token_value)
    sessions_collection = Database.get_db()["sessions"]
    session = await sessions_collection.find_one(
        {
            "refresh_token_hash": refresh_token_hash,
            "is_revoked": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        }
    )
    if session is None:
        return None

    user = await user_manager.get(session["user_id"])
    if user is None or not user.is_active:
        return None

    await sessions_collection.delete_one({"refresh_token_hash": refresh_token_hash})

    strategy = get_database_strategy(access_token_db)
    login_response = await auth_backend.login(strategy, user)
    await user_manager.on_after_login(user, request, login_response)
    return user, login_response

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(
    request: Request,
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager=Depends(get_user_manager),
    strategy=Depends(get_database_strategy),
):
    user = await user_manager.authenticate(credentials)
    if user is None or not user.is_active:
        audit_event("auth.login", outcome="failure", request=request, email=credentials.username, reason="bad_credentials")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "LOGIN_BAD_CREDENTIALS", "message": "Invalid email or password."},
        )
    if not user.is_verified:
        audit_event("auth.login", outcome="failure", request=request, user_id=str(user.id), email=user.email, reason="email_unverified")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "LOGIN_USER_NOT_VERIFIED", "message": "User email is not verified."},
        )

    if user.totp_enabled:
        totp_session_id = f"totp_{uuid4().hex}"
        redis_client = RedisManager.get_client()
        await redis_client.set(
            f"totp_session:{totp_session_id}",
            user.id,
            ex=300,
        )
        await redis_client.delete(f"totp_attempts:{totp_session_id}")
        audit_event("auth.login.2fa_challenge", outcome="issued", request=request, user_id=str(user.id), email=user.email)
        return ok(
            data={"requires_2fa": True, "totp_session_id": totp_session_id},
            request=request,
        )

    login_response = await auth_backend.login(strategy, user)
    await user_manager.on_after_login(user, request, login_response)

    response = JSONResponse(
        status_code=200,
        content=ok(data={"message": "Login successful."}, request=request),
    )
    await _attach_refresh_session(
        user=user,
        request=request,
        source_response=login_response,
        destination_response=response,
    )
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def logout(
    request: Request,
    current_user_token=Depends(fastapi_users.authenticator.current_user_token(active=True)),
):
    user, token = current_user_token
    audit_event("auth.logout", outcome="success", request=request, user_id=str(user.id), email=user.email)
    sessions_collection = Database.get_db()["sessions"]
    await sessions_collection.update_one(
        {"token": token, "user_id": str(user.id)},
        {
            "$set": {
                "is_revoked": True,
                "last_used_at": datetime.now(timezone.utc),
            }
        },
    )
    response = await auth_backend.transport.get_logout_response()
    _clear_refresh_cookie(response)
    return response


@router.get("/session")
async def session(
    request: Request,
    current_user=Depends(fastapi_users.current_user(optional=True, active=True)),
):
    if current_user is not None:
        return ok(
            data={"authenticated": True, "user": _serialize_user(current_user)},
            request=request,
        )

    refreshed = await _build_login_response_from_refresh_cookie(request=request)
    if refreshed is None:
        return ok(
            data={"authenticated": False, "user": None},
            request=request,
        )

    user, login_response = refreshed
    response = JSONResponse(
        status_code=200,
        content=ok(
            data={"authenticated": True, "user": _serialize_user(user)},
            request=request,
        ),
    )
    await _attach_refresh_session(
        user=user,
        request=request,
        source_response=login_response,
        destination_response=response,
    )
    return response


@router.post("/2fa/verify")
async def verify_2fa(
    request: Request,
    payload: Login2FARequest,
    user_manager=Depends(get_user_manager),
    current_user=Depends(fastapi_users.current_user(optional=True, active=True)),
    strategy=Depends(get_database_strategy),
):
    redis_client = RedisManager.get_client()
    if payload.totp_session_id:
        session_key = f"totp_session:{payload.totp_session_id}"
        attempts_key = f"totp_attempts:{payload.totp_session_id}"
        user_id = await redis_client.get(session_key)
        if not user_id:
            audit_event("auth.2fa.verify", outcome="failure", request=request, reason="session_expired")
            return json_error(
                status_code=404,
                code="NOT_FOUND",
                message="Two-factor session expired.",
                request=request,
            )

        attempts = await redis_client.incr(attempts_key)
        if attempts == 1:
            await redis_client.expire(attempts_key, 300)
        if attempts > 5:
            audit_event("auth.2fa.verify", outcome="failure", request=request, user_id=str(user_id), reason="attempt_limit")
            return json_error(
                status_code=429,
                code="OTP_LOCKED",
                message="Too many attempts. Please sign in again.",
                request=request,
            )

        user = await user_manager.get(user_id)
        if user is None:
            audit_event("auth.2fa.verify", outcome="failure", request=request, user_id=str(user_id), reason="user_missing")
            return json_error(
                status_code=404,
                code="NOT_FOUND",
                message="Two-factor session expired.",
                request=request,
            )

        secret = decrypt_field(user.totp_secret, settings.SECRET_KEY) if user.totp_secret else None
        if not secret or not pyotp.TOTP(secret).verify(payload.code, valid_window=1):
            if attempts >= 5:
                audit_event("auth.2fa.verify", outcome="failure", request=request, user_id=str(user.id), email=user.email, reason="attempt_limit")
                return json_error(
                    status_code=429,
                    code="OTP_LOCKED",
                    message="Too many attempts. Please sign in again.",
                    request=request,
                )
            audit_event("auth.2fa.verify", outcome="failure", request=request, user_id=str(user.id), email=user.email, reason="invalid_code")
            return json_error(
                status_code=400,
                code="INVALID_OTP",
                message="Incorrect code.",
                request=request,
            )

        await redis_client.delete(session_key)
        await redis_client.delete(attempts_key)

        login_response = await auth_backend.login(strategy, user)
        await user_manager.on_after_login(user, request, login_response)

        response = JSONResponse(
            status_code=200,
            content=ok(data={"message": "Two-factor verified."}, request=request),
        )
        audit_event("auth.2fa.verify", outcome="success", request=request, user_id=str(user.id), email=user.email)
        await _attach_refresh_session(
            user=user,
            request=request,
            source_response=login_response,
            destination_response=response,
        )
        return response

    if current_user is None or not current_user.totp_secret:
        audit_event("auth.2fa.enable", outcome="failure", request=request, reason="session_expired")
        return json_error(
            status_code=404,
            code="NOT_FOUND",
            message="Two-factor session expired.",
            request=request,
        )

    secret = decrypt_field(current_user.totp_secret, settings.SECRET_KEY)
    if not pyotp.TOTP(secret).verify(payload.code, valid_window=1):
        audit_event("auth.2fa.enable", outcome="failure", request=request, user_id=str(current_user.id), email=current_user.email, reason="invalid_code")
        return json_error(
            status_code=400,
            code="INVALID_OTP",
            message="Incorrect code.",
            request=request,
        )

    from app.db import Database

    await Database.get_db()["users"].update_one(
        {"id": str(current_user.id)},
        {"$set": {"totp_enabled": True}},
    )
    audit_event("auth.2fa.enable", outcome="success", request=request, user_id=str(current_user.id), email=current_user.email)
    return ok(data={"message": "2FA enabled."}, request=request)


@router.post("/refresh")
async def refresh_token(
    request: Request,
):
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        audit_event("auth.refresh", outcome="failure", request=request, reason="missing_token")
        return json_error(
            status_code=401,
            code="TOKEN_INVALID",
            message="Refresh token is missing.",
            request=request,
        )

    user_manager = None
    async for user_db in get_user_db():
        user_manager = UserManager(user_db)
        break

    access_token_db = None
    async for db in get_access_token_db():
        access_token_db = db
        break

    if user_manager is None or access_token_db is None:
        audit_event("auth.refresh", outcome="failure", request=request, reason="service_unavailable")
        return json_error(
            status_code=503,
            code="SERVICE_DEGRADED",
            message="Auth services are unavailable.",
            request=request,
        )

    strategy = get_database_strategy(access_token_db)

    refresh_token_hash = _hash_refresh_token(refresh_token_value)
    sessions_collection = Database.get_db()["sessions"]
    session = await sessions_collection.find_one(
        {
            "refresh_token_hash": refresh_token_hash,
            "is_revoked": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        }
    )
    if session is None:
        revoked_session = await sessions_collection.find_one(
            {"refresh_token_hash": refresh_token_hash, "is_revoked": True}
        )
        if revoked_session is not None:
            audit_event("auth.refresh", outcome="failure", request=request, reason="revoked_token")
            return json_error(
                status_code=401,
                code="TOKEN_INVALID",
                message="Refresh token has been revoked.",
                request=request,
            )
        audit_event("auth.refresh", outcome="failure", request=request, reason="expired_token")
        return json_error(
            status_code=401,
            code="TOKEN_EXPIRED",
            message="Refresh token expired.",
            request=request,
        )

    user = await user_manager.get(session["user_id"])
    if user is None or not user.is_active:
        audit_event("auth.refresh", outcome="failure", request=request, reason="invalid_user")
        return json_error(
            status_code=401,
            code="TOKEN_INVALID",
            message="Refresh token is invalid.",
            request=request,
        )

    await sessions_collection.delete_one({"refresh_token_hash": refresh_token_hash})

    login_response = await auth_backend.login(strategy, user)
    await user_manager.on_after_login(user, request, login_response)

    response = JSONResponse(
        status_code=200,
        content=ok(data={"message": "Token refreshed."}, request=request),
    )
    audit_event("auth.refresh", outcome="success", request=request, user_id=str(user.id), email=user.email)
    await _attach_refresh_session(
        user=user,
        request=request,
        source_response=login_response,
        destination_response=response,
    )
    return response


@router.post("/verify")
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    user_manager: UserManager = Depends(get_user_manager),
):
    try:
        user = await user_manager.verify(payload.token, request)
    except exceptions.UserAlreadyVerified:
        audit_event("auth.verify_email", outcome="already_verified", request=request)
        return JSONResponse(
            status_code=200,
            content=ok(data={"message": "Email already verified."}, request=request),
        )
    except exceptions.InvalidVerifyToken:
        audit_event("auth.verify_email", outcome="failure", request=request, reason="invalid_token")
        return json_error(
            status_code=400,
            code="VERIFY_INVALID_TOKEN",
            message="This verification link is invalid or expired.",
            request=request,
        )

    audit_event("auth.verify_email", outcome="success", request=request, user_id=str(user.id), email=user.email)
    return JSONResponse(
        status_code=200,
        content=ok(
            data={"message": "Email verified.", "user": _serialize_user(user)},
            request=request,
        ),
    )


@router.post("/request-verify-token")
async def request_verify_token(
    payload: RequestVerifyEmailRequest,
    request: Request,
    user_manager: UserManager = Depends(get_user_manager),
):
    audit_email = str(payload.email)
    try:
        user = await user_manager.get_by_email(audit_email)
        await user_manager.request_verify(user, request)
    except (
        exceptions.UserNotExists,
        exceptions.UserInactive,
        exceptions.UserAlreadyVerified,
    ):
        pass

    audit_event("auth.verify_email.request", outcome="accepted", request=request, email=audit_email)
    return JSONResponse(
        status_code=202,
        content=ok(data={"message": "Verification email requested."}, request=request),
    )


router.include_router(fastapi_users.get_register_router(UserRead, UserCreate))
router.include_router(fastapi_users.get_reset_password_router())
router.include_router(fastapi_users.get_users_router(UserRead, UserUpdate))
