from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from fastapi_users.jwt import decode_jwt, generate_jwt
from httpx_oauth.clients.google import GoogleOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback

from app.auth.backend import auth_backend, get_database_strategy
from app.auth.manager import get_user_manager
from app.config import settings
from app.lib.audit import audit_event
from app.routers._envelope import json_error


logger = logging.getLogger(__name__)
STATE_TOKEN_AUDIENCE = "fastapi-users:oauth-state"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"


@dataclass
class OAuthAccountInfo:
    oauth_name: str
    account_id: str
    account_email: str
    account_image_url: str | None = None


google_oauth_client = GoogleOAuth2(
    settings.GOOGLE_CLIENT_ID or "missing-google-client-id",
    settings.GOOGLE_CLIENT_SECRET or "missing-google-client-secret",
    name="google",
)

router = APIRouter(prefix="/google", tags=["auth-google"])


def generate_state_token(data: dict[str, str], lifetime_seconds: int = 3600) -> str:
    data["aud"] = STATE_TOKEN_AUDIENCE
    return generate_jwt(data, settings.SECRET_KEY, lifetime_seconds)


async def fetch_google_user_info(access_token: str) -> dict:
    async with google_oauth_client.get_httpx_client() as client:
        response = await client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={
                **google_oauth_client.request_headers,
                "Authorization": f"Bearer {access_token}",
            },
        )

    if response.status_code >= 400:
        raise ValueError(f"Google userinfo failed with status {response.status_code}: {response.text}")

    return response.json()


async def fetch_google_account_image_url(access_token: str) -> str | None:
    try:
        user_info = await fetch_google_user_info(access_token)
    except Exception:
        return None
    picture = user_info.get("picture")
    return picture if isinstance(picture, str) else None


@router.get("/authorize")
async def authorize(request: Request, scopes: Optional[List[str]] = Query(default=None)):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        audit_event("auth.oauth.google.authorize", outcome="failure", request=request, reason="not_configured")
        return json_error(
            status_code=503,
            code="OAUTH_NOT_CONFIGURED",
            message="Google OAuth is not configured.",
            request=request,
        )

    redirect_uri = settings.GOOGLE_REDIRECT_URI or str(request.url_for("google_callback"))
    state = generate_state_token({})
    authorization_url = await google_oauth_client.get_authorization_url(
        redirect_uri,
        state,
        scopes,
    )
    audit_event("auth.oauth.google.authorize", outcome="redirect", request=request)
    return RedirectResponse(authorization_url, status_code=302)


@router.get("/callback", name="google_callback")
async def callback(
    request: Request,
    access_token_state: tuple = Depends(
        OAuth2AuthorizeCallback(google_oauth_client, route_name="google_callback")
    ),
    user_manager=Depends(get_user_manager),
    strategy=Depends(get_database_strategy),
):
    try:
        from app.routers.auth import _attach_refresh_session

        token, state = access_token_state
        decode_jwt(state, settings.SECRET_KEY, [STATE_TOKEN_AUDIENCE])
        user_info = await fetch_google_user_info(token["access_token"])
        account_id = user_info.get("sub")
        account_email = user_info.get("email")
        account_image_url = user_info.get("picture")
        if not isinstance(account_id, str) or not account_id:
            raise ValueError("Missing Google account id")
        if not account_email:
            raise ValueError("Missing Google email")

        oauth_account = OAuthAccountInfo(
            oauth_name="google",
            account_id=account_id,
            account_email=account_email,
            account_image_url=account_image_url if isinstance(account_image_url, str) else None,
        )
        request.state.google_account_image_url = oauth_account.account_image_url

        user = await user_manager.oauth_callback(
            oauth_account.oauth_name,
            token["access_token"],
            oauth_account.account_id,
            oauth_account.account_email,
            token.get("expires_at"),
            token.get("refresh_token"),
            request,
            associate_by_email=True,
            is_verified_by_default=True,
        )

        if not user.is_active:
            raise ValueError("Inactive OAuth user")

        login_response = await auth_backend.login(strategy, user)
        await user_manager.on_after_login(user, request, login_response)

        response = RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard", status_code=302)
        audit_event("auth.oauth.google.callback", outcome="success", request=request, user_id=str(user.id), email=user.email)
        await _attach_refresh_session(
            user=user,
            request=request,
            source_response=login_response,
            destination_response=response,
        )
        return response
    except Exception:
        logger.exception("Google OAuth callback failed")
        audit_event("auth.oauth.google.callback", outcome="failure", request=request, reason="callback_failed")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/signin?error=oauth_failed",
            status_code=302,
        )
