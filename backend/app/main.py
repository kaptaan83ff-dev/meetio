from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.config import settings
from app.db import Database
from app.redis import RedisManager
from app.routers import auth, health, settings as settings_router, websocket, stubs
from app.auth.oauth import router as google_oauth_router
import logging
from uuid import uuid4
from fastapi_users.exceptions import UserAlreadyExists
from app.routers._envelope import http_exception_to_json, validation_error_to_json
from app.routers._envelope import json_error
from app.lib.rate_limit import enforce_auth_route_rate_limit, limiter, rate_limit_exceeded_handler

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await Database.ping()
        logger.info("Database connection established.")
        await RedisManager.ping()
        logger.info("Redis connection established.")
    except Exception as e:
        logger.error(f"Failed to initialize connections: {e}")
        raise e
    yield
    Database.close()
    await RedisManager.close()

app = FastAPI(title="MeetIO API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Register health check directly on app (for Railway monitoring at /health)
app.include_router(health.router)
app.include_router(websocket.router)

# Request ID Middleware (used in API response envelope meta)
class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request.state.request_id = f"req_{uuid4().hex[:12]}"
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        return response

app.add_middleware(RequestIdMiddleware)


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        limited_response = await enforce_auth_route_rate_limit(request)
        if limited_response is not None:
            return limited_response
        return await call_next(request)


app.add_middleware(AuthRateLimitMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return http_exception_to_json(exc, request)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return validation_error_to_json(exc, request)


@app.exception_handler(UserAlreadyExists)
async def user_already_exists_handler(request: Request, exc: UserAlreadyExists) -> JSONResponse:
    return json_error(
        status_code=409,
        code="EMAIL_TAKEN",
        message="A user with this email already exists.",
        request=request,
    )

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if request.url.path.startswith(("/v1/auth", "/v1/settings")):
            response.headers["Cache-Control"] = "no-store"
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

# V1 Router
v1_router = APIRouter(prefix="/v1")

v1_router.include_router(auth.router)
v1_router.include_router(google_oauth_router, prefix="/auth")
v1_router.include_router(settings_router.router)
v1_router.include_router(stubs.router)

app.include_router(v1_router)
