from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import settings
from app.db import Database
from app.redis import RedisManager
from app.routers import health, websocket
import logging

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

# Register health check directly on app (for Railway monitoring at /health)
app.include_router(health.router)
app.include_router(websocket.router)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# V1 Router
v1_router = APIRouter(prefix="/v1")

# Stub routers for domain features
# These will be replaced with real routers in later tasks
@v1_router.get("/auth", tags=["Stubs"])
async def auth_stub(): return {"message": "Auth router stub"}

@v1_router.get("/users", tags=["Stubs"])
async def users_stub(): return {"message": "Users router stub"}

@v1_router.get("/meetings", tags=["Stubs"])
async def meetings_stub(): return {"message": "Meetings router stub"}

@v1_router.get("/dashboard", tags=["Stubs"])
async def dashboard_stub(): return {"message": "Dashboard router stub"}

@v1_router.get("/calendar", tags=["Stubs"])
async def calendar_stub(): return {"message": "Calendar router stub"}

@v1_router.get("/messenger", tags=["Stubs"])
async def messenger_stub(): return {"message": "Messenger router stub"}

@v1_router.get("/action-items", tags=["Stubs"])
async def action_items_stub(): return {"message": "Action Items router stub"}

@v1_router.get("/settings", tags=["Stubs"])
async def settings_stub(): return {"message": "Settings router stub"}

@v1_router.get("/profile", tags=["Stubs"])
async def profile_stub(): return {"message": "Profile router stub"}

@v1_router.get("/notifications", tags=["Stubs"])
async def notifications_stub(): return {"message": "Notifications router stub"}

app.include_router(v1_router)
