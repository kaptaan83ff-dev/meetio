from __future__ import annotations

import logging
from typing import Any

from fastapi import Request


logger = logging.getLogger("meetio.audit")


def _anonymize_ip(address: str | None) -> str | None:
    if not address:
        return None
    parts = address.split(".")
    if len(parts) != 4:
        return address
    return ".".join(parts[:3] + ["x"])


def audit_event(
    event: str,
    *,
    outcome: str,
    request: Request | None = None,
    user_id: str | None = None,
    email: str | None = None,
    reason: str | None = None,
    **details: Any,
) -> None:
    payload = {
        "event": event,
        "outcome": outcome,
        "user_id": user_id,
        "email": email.lower() if email else None,
        "reason": reason,
        "request_id": getattr(getattr(request, "state", None), "request_id", None) if request else None,
        "ip_anonymised": _anonymize_ip(getattr(getattr(request, "client", None), "host", None)) if request else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        **details,
    }
    logger.info("security_audit", extra={"audit": payload})
