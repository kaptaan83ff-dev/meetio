from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_request_id(request: Request | None) -> str:
    if request is None:
        return f"req_{uuid4().hex[:12]}"
    rid = getattr(request.state, "request_id", None)
    return rid or f"req_{uuid4().hex[:12]}"


def ok(*, data: Any, request: Request | None = None) -> dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "error": None,
        "meta": {"timestamp": iso_utc_now(), "request_id": get_request_id(request)},
    }


def fail(*, code: str, message: str, field: str | None = None, request: Request | None = None) -> dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "field": field},
        "meta": {"timestamp": iso_utc_now(), "request_id": get_request_id(request)},
    }


def json_error(*, status_code: int, code: str, message: str, field: str | None = None, request: Request | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=fail(code=code, message=message, field=field, request=request),
    )


def http_exception_to_json(exc: HTTPException, request: Request) -> JSONResponse:
    code = "HTTP_ERROR"
    message = "Request failed."
    field: str | None = None

    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code") or code)
        message = str(exc.detail.get("reason") or exc.detail.get("message") or message)
        field = exc.detail.get("field")
    elif isinstance(exc.detail, str):
        message = exc.detail

    return json_error(status_code=exc.status_code, code=code, message=message, field=field, request=request)


def validation_error_to_json(exc: RequestValidationError, request: Request) -> JSONResponse:
    field: str | None = None
    message = "Validation error."

    if exc.errors():
        err0 = exc.errors()[0]
        loc = err0.get("loc") or ()
        if isinstance(loc, (list, tuple)) and len(loc) >= 2:
            field = str(loc[-1])
        message = str(err0.get("msg") or message)

    return json_error(status_code=422, code="VALIDATION_ERROR", message=message, field=field, request=request)
