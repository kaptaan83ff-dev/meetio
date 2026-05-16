from __future__ import annotations

from fastapi import Depends
from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, CookieTransport
from fastapi_users.authentication.strategy.db import AccessTokenDatabase, DatabaseStrategy

from app.auth.manager import get_user_manager
from app.auth.sessions import get_access_token_db
from app.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserRead


cookie_transport = CookieTransport(
    cookie_name="fastapiusersauth",
    cookie_max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    cookie_secure=settings.APP_ENV != "development",
    cookie_httponly=True,
    cookie_samesite="lax",
)


def get_database_strategy(
    access_token_db: AccessTokenDatabase = Depends(get_access_token_db),
) -> DatabaseStrategy:
    return DatabaseStrategy(
        access_token_db,
        lifetime_seconds=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


auth_backend = AuthenticationBackend(
    name="database",
    transport=cookie_transport,
    get_strategy=get_database_strategy,
)

fastapi_users = FastAPIUsers[User, str](get_user_manager, [auth_backend])
