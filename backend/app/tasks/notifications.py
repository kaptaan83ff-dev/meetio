from __future__ import annotations

import asyncio
import logging

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError

from app.celery_app import app as celery_app
from app.config import settings
from app.db import Database
from app.lib.email import send_email


logger = logging.getLogger(__name__)


def _build_verification_email_html(token: str) -> str:
    verification_link = f"{settings.FRONTEND_URL}/verify?token={token}"
    return (
        "<p>Welcome to MeetIO.</p>"
        f'<p>Verify your account by clicking <a href="{verification_link}">this link</a>.</p>'
    )


def _build_password_reset_email_html(token: str) -> str:
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    return (
        "<p>You requested a password reset for your MeetIO account.</p>"
        f'<p>Reset your password by clicking <a href="{reset_link}">this link</a>.</p>'
    )


def _send_resend_email(*, to_email: str, html: str, subject: str) -> None:
    send_email(to_email=to_email, subject=subject, html=html)


async def _load_user(user_id: str):
    users_collection = Database.get_db()["users"]
    user = await users_collection.find_one({"id": user_id})
    if user is None:
        user = await users_collection.find_one({"_id": user_id})
    return user


def _load_user_sync(user_id: str):
    try:
        return asyncio.run(_load_user(user_id))
    finally:
        Database.close()


@celery_app.task(
    name="tasks.notifications.send_verification_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_verification_email(self, user_id: str, token: str):
    """
    Send a verification email using the configured email transport.
    Retries up to 3 times with 60s backoff.
    """
    try:
        user = _load_user_sync(user_id)
        if user is None:
            raise ValueError(f"User {user_id} not found")

        html = _build_verification_email_html(token)
        _send_resend_email(
            to_email=user["email"],
            html=html,
            subject="Verify your MeetIO account",
        )
    except MaxRetriesExceededError:
        logger.exception("Verification email retries exhausted for user %s", user_id)
        raise
    except Exception as exc:
        try:
            raise self.retry(exc=exc, countdown=60)
        except MaxRetriesExceededError:
            logger.exception("Verification email retries exhausted for user %s", user_id)
            raise


@celery_app.task(
    name="tasks.notifications.send_password_reset_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_password_reset_email(self, user_id: str, token: str):
    """
    Send a password reset email using the configured email transport.
    Retries up to 3 times with 60s backoff.
    """
    try:
        user = _load_user_sync(user_id)
        if user is None:
            raise ValueError(f"User {user_id} not found")

        html = _build_password_reset_email_html(token)
        _send_resend_email(
            to_email=user["email"],
            html=html,
            subject="Reset your MeetIO password",
        )
    except MaxRetriesExceededError:
        logger.exception("Password reset email retries exhausted for user %s", user_id)
        raise
    except Exception as exc:
        try:
            raise self.retry(exc=exc, countdown=60)
        except MaxRetriesExceededError:
            logger.exception("Password reset email retries exhausted for user %s", user_id)
            raise

@celery_app.task(name="tasks.notifications.send_due_date_reminders")
def send_due_date_reminders():
    """
    TODO: Feature 15
    Sends email and in-app notifications for action items due today.
    """
    pass
