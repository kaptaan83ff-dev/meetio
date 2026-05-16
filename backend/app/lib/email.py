from __future__ import annotations

import logging
import re
import smtplib
from enum import StrEnum
from email.message import EmailMessage
from typing import Any

import resend

from app.config import settings


logger = logging.getLogger(__name__)


class EmailTransport(StrEnum):
    AUTO = "auto"
    CONSOLE = "console"
    MAILPIT = "mailpit"
    RESEND = "resend"


def _extract_links(html: str) -> list[str]:
    return re.findall(r'href="([^"]+)"', html)


def _resolve_transport() -> EmailTransport:
    configured_transport = EmailTransport(settings.EMAIL_TRANSPORT)
    if configured_transport is not EmailTransport.AUTO:
        return configured_transport

    if settings.APP_ENV == "development":
        return EmailTransport.CONSOLE

    if settings.RESEND_API_KEY:
        return EmailTransport.RESEND

    raise RuntimeError("RESEND_API_KEY is required when EMAIL_TRANSPORT=auto outside development")


def _send_console_email(*, to_email: str, subject: str, html: str) -> dict[str, Any]:
    links = _extract_links(html)
    logger.info(
        "DEV email captured",
        extra={
            "to_email": to_email,
            "subject": subject,
            "links": links,
        },
    )
    logger.debug("DEV email html for %s: %s", to_email, html)
    return {
        "transport": "console",
        "to": to_email,
        "subject": subject,
        "links": links,
        "html": html,
    }


def _send_resend_email(*, to_email: str, subject: str, html: str) -> Any:
    resend.api_key = settings.RESEND_API_KEY
    return resend.Emails.send(
        {
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )


def _send_mailpit_email(*, to_email: str, subject: str, html: str) -> dict[str, Any]:
    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(re.sub(r"<[^>]+>", " ", html))
    message.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.MAILPIT_HOST, settings.MAILPIT_PORT, timeout=10) as smtp:
        if settings.MAILPIT_USE_TLS:
            smtp.starttls()
        if settings.MAILPIT_USERNAME:
            smtp.login(settings.MAILPIT_USERNAME, settings.MAILPIT_PASSWORD or "")
        smtp.send_message(message)

    logger.info(
        "Mailpit email sent",
        extra={"to_email": to_email, "subject": subject, "host": settings.MAILPIT_HOST, "port": settings.MAILPIT_PORT},
    )
    return {
        "transport": "mailpit",
        "to": to_email,
        "subject": subject,
        "host": settings.MAILPIT_HOST,
        "port": settings.MAILPIT_PORT,
    }


def send_email(*, to_email: str, subject: str, html: str) -> Any:
    transport = _resolve_transport()
    if transport is EmailTransport.CONSOLE:
        return _send_console_email(to_email=to_email, subject=subject, html=html)
    if transport is EmailTransport.MAILPIT:
        return _send_mailpit_email(to_email=to_email, subject=subject, html=html)

    return _send_resend_email(to_email=to_email, subject=subject, html=html)
