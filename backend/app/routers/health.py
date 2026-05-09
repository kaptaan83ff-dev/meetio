from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis.asyncio import Redis
from app.db import get_db
from app.redis import get_redis
from app.celery_app import app as celery_app

router = APIRouter(tags=["Health"])

async def check_mongodb(db: AsyncIOMotorDatabase) -> bool:
    try:
        result = await db.command("ping")
        return result.get("ok") == 1.0
    except Exception as e:
        print(f"MongoDB Health Check Failed: {e}")
        return False

async def check_redis(redis: Redis) -> bool:
    try:
        return await redis.ping()
    except Exception:
        return False

async def check_celery() -> bool:
    try:
        # Inspect active workers with a 3s timeout
        inspect = celery_app.control.inspect(timeout=3.0)
        active = inspect.active()
        return active is not None and len(active) > 0
    except Exception:
        return False

@router.get("/health")
async def health_check(
    db: AsyncIOMotorDatabase = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Health check endpoint for Railway/Infrastructure monitoring.
    Returns 200 if all systems are OK, 503 if any system is degraded.
    """
    mongo_ok = await check_mongodb(db)
    redis_ok = await check_redis(redis)
    celery_ok = await check_celery()
    
    all_ok = all([mongo_ok, redis_ok, celery_ok])
    
    response_data = {
        "success": all_ok,
        "data": {
            "status": "ok" if all_ok else "degraded",
            "checks": {
                "mongodb": mongo_ok,
                "redis": redis_ok,
                "celery": celery_ok
            }
        },
        "meta": {
            "version": "0.1.0"
        }
    }
    
    if all_ok:
        return response_data
    
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=response_data
    )
