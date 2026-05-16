from __future__ import annotations

import time
from dataclasses import dataclass

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.redis import RedisManager


limiter = Limiter(
    key_func=get_remote_address,
    headers_enabled=True,
)


async def rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    from app.routers._envelope import get_request_id, json_error

    request.state.request_id = get_request_id(request)
    response = json_error(
        status_code=429,
        code="RATE_LIMIT_EXCEEDED",
        message="Too many requests.",
        request=request,
    )
    response.headers["X-Request-Id"] = request.state.request_id
    return response


@dataclass(frozen=True)
class RouteRateLimitRule:
    method: str
    path: str
    limit: int
    window_seconds: int


AUTH_RATE_LIMIT_RULES: tuple[RouteRateLimitRule, ...] = (
    RouteRateLimitRule("POST", "/v1/auth/login", 20, 60),
    RouteRateLimitRule("POST", "/v1/auth/register", 20, 60),
    RouteRateLimitRule("POST", "/v1/auth/forgot-password", 10, 60),
    RouteRateLimitRule("POST", "/v1/auth/reset-password", 20, 60),
    RouteRateLimitRule("POST", "/v1/auth/verify", 30, 60),
    RouteRateLimitRule("POST", "/v1/auth/request-verify-token", 10, 60),
    RouteRateLimitRule("POST", "/v1/auth/2fa/verify", 20, 60),
    RouteRateLimitRule("POST", "/v1/auth/refresh", 60, 60),
    RouteRateLimitRule("POST", "/v1/auth/logout", 20, 60),
    RouteRateLimitRule("GET", "/v1/auth/google/authorize", 20, 60),
    RouteRateLimitRule("GET", "/v1/auth/google/callback", 30, 60),
    RouteRateLimitRule("POST", "/v1/settings/2fa", 20, 60),
)

_in_memory_counters: dict[str, tuple[int, int]] = {}


def reset_in_memory_rate_limits() -> None:
    _in_memory_counters.clear()


def _find_auth_rate_limit_rule(request: Request) -> RouteRateLimitRule | None:
    method = request.method.upper()
    path = request.url.path.rstrip("/") or "/"
    for rule in AUTH_RATE_LIMIT_RULES:
        if rule.method == method and rule.path == path:
            return rule
    return None


def _client_key(request: Request) -> str:
    host = getattr(request.client, "host", None) or "unknown"
    return host.replace(":", "_")


async def _increment_counter(key: str, window_seconds: int) -> tuple[int, int]:
    window = int(time.time() // window_seconds)
    redis_key = f"rate_limit:{key}:{window}"

    try:
        redis_client = RedisManager.get_client()
        count = await redis_client.incr(redis_key)
        if count == 1:
            await redis_client.expire(redis_key, window_seconds)
        reset_at = (window + 1) * window_seconds
        return int(count), reset_at
    except Exception:
        memory_key = f"{key}:{window}"
        count, _ = _in_memory_counters.get(memory_key, (0, (window + 1) * window_seconds))
        count += 1
        reset_at = (window + 1) * window_seconds
        _in_memory_counters[memory_key] = (count, reset_at)
        return count, reset_at


def _rate_limit_response(request: Request, rule: RouteRateLimitRule, reset_at: int) -> JSONResponse:
    from app.routers._envelope import get_request_id, json_error

    request.state.request_id = get_request_id(request)
    retry_after = max(1, reset_at - int(time.time()))
    response = json_error(
        status_code=429,
        code="RATE_LIMIT_EXCEEDED",
        message="Too many requests. Please wait and try again.",
        request=request,
    )
    response.headers["Retry-After"] = str(retry_after)
    response.headers["X-RateLimit-Limit"] = str(rule.limit)
    response.headers["X-RateLimit-Remaining"] = "0"
    response.headers["X-RateLimit-Reset"] = str(reset_at)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


async def enforce_auth_route_rate_limit(request: Request) -> JSONResponse | None:
    rule = _find_auth_rate_limit_rule(request)
    if rule is None:
        return None

    key = f"{rule.method}:{rule.path}:{_client_key(request)}"
    count, reset_at = await _increment_counter(key, rule.window_seconds)
    if count > rule.limit:
        return _rate_limit_response(request, rule, reset_at)
    return None
