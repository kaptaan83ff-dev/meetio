import pytest
from celery.exceptions import MaxRetriesExceededError

from app.config import settings
from app.tasks.notifications import (
    _build_password_reset_email_html,
    _build_verification_email_html,
    _load_user_sync,
    send_password_reset_email,
    send_verification_email,
)


def test_build_verification_email_html_uses_frontend_verification_link():
    token = "token-123"
    html = _build_verification_email_html(token)

    assert settings.FRONTEND_URL in html
    assert f"/verify?token={token}" in html


def test_send_verification_email_uses_expected_subject_and_body(monkeypatch):
    captured = {}

    async def fake_load_user(user_id: str):
        return {"email": "person@example.com"}

    def fake_send_resend_email(*, to_email: str, html: str, subject: str) -> None:
        captured["to_email"] = to_email
        captured["html"] = html
        captured["subject"] = subject

    monkeypatch.setattr("app.tasks.notifications._load_user", fake_load_user)
    monkeypatch.setattr("app.tasks.notifications._send_resend_email", fake_send_resend_email)

    send_verification_email.run("usr_test", "token-123")

    assert captured["to_email"] == "person@example.com"
    assert captured["subject"] == "Verify your MeetIO account"
    assert f"/verify?token=token-123" in captured["html"]


def test_load_user_sync_closes_database_singleton(monkeypatch):
    close_calls = []

    async def fake_load_user(user_id: str):
        return {"email": "person@example.com"}

    monkeypatch.setattr("app.tasks.notifications._load_user", fake_load_user)
    monkeypatch.setattr("app.tasks.notifications.Database.close", lambda: close_calls.append(True))

    assert _load_user_sync("usr_test") == {"email": "person@example.com"}
    assert close_calls == [True]


def test_send_verification_email_retries_on_failure(monkeypatch):
    retry_calls = []

    async def fake_load_user(user_id: str):
        return {"email": "person@example.com"}

    def fake_send_resend_email(*, to_email: str, html: str, subject: str) -> None:
        raise RuntimeError("boom")

    def fake_retry(*, exc=None, countdown=None):
        retry_calls.append({"exc": exc, "countdown": countdown})
        raise MaxRetriesExceededError()

    monkeypatch.setattr("app.tasks.notifications._load_user", fake_load_user)
    monkeypatch.setattr("app.tasks.notifications._send_resend_email", fake_send_resend_email)
    monkeypatch.setattr(send_verification_email, "retry", fake_retry)

    with pytest.raises(MaxRetriesExceededError):
        send_verification_email.run("usr_test", "token-123")

    assert retry_calls
    assert retry_calls[0]["countdown"] == 60


def test_build_password_reset_email_html_uses_reset_link():
    token = "token-456"
    html = _build_password_reset_email_html(token)

    assert settings.FRONTEND_URL in html
    assert f"/reset-password?token={token}" in html


def test_send_password_reset_email_uses_expected_subject_and_body(monkeypatch):
    captured = {}

    async def fake_load_user(user_id: str):
        return {"email": "person@example.com"}

    def fake_send_resend_email(*, to_email: str, html: str, subject: str) -> None:
        captured["to_email"] = to_email
        captured["html"] = html
        captured["subject"] = subject

    monkeypatch.setattr("app.tasks.notifications._load_user", fake_load_user)
    monkeypatch.setattr("app.tasks.notifications._send_resend_email", fake_send_resend_email)

    send_password_reset_email.run("usr_test", "token-456")

    assert captured["to_email"] == "person@example.com"
    assert captured["subject"] == "Reset your MeetIO password"
    assert f"/reset-password?token=token-456" in captured["html"]


def test_send_password_reset_email_retries_on_failure(monkeypatch):
    retry_calls = []

    async def fake_load_user(user_id: str):
        return {"email": "person@example.com"}

    def fake_send_resend_email(*, to_email: str, html: str, subject: str) -> None:
        raise RuntimeError("boom")

    def fake_retry(*, exc=None, countdown=None):
        retry_calls.append({"exc": exc, "countdown": countdown})
        raise MaxRetriesExceededError()

    monkeypatch.setattr("app.tasks.notifications._load_user", fake_load_user)
    monkeypatch.setattr("app.tasks.notifications._send_resend_email", fake_send_resend_email)
    monkeypatch.setattr(send_password_reset_email, "retry", fake_retry)

    with pytest.raises(MaxRetriesExceededError):
        send_password_reset_email.run("usr_test", "token-456")

    assert retry_calls
    assert retry_calls[0]["countdown"] == 60
