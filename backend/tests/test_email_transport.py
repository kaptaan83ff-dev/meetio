from app.lib.email import _extract_links, _resolve_transport, EmailTransport, settings


def test_extract_links_returns_hrefs():
    html = '<p><a href="https://example.com/a">A</a> <a href="https://example.com/b">B</a></p>'

    assert _extract_links(html) == ["https://example.com/a", "https://example.com/b"]


def test_resolve_transport_uses_console_in_development(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "auto")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")

    assert _resolve_transport() is EmailTransport.CONSOLE


def test_resolve_transport_accepts_mailpit(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "mailpit")

    assert _resolve_transport() is EmailTransport.MAILPIT


def test_resolve_transport_requires_resend_outside_development(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "auto")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")

    try:
        _resolve_transport()
        assert False, "expected RuntimeError"
    except RuntimeError as exc:
        assert "RESEND_API_KEY is required" in str(exc)


def test_send_mailpit_email_uses_smtp(monkeypatch):
    from app.lib import email as email_module

    class FakeSMTP:
        def __init__(self, host, port, timeout=10):
            self.host = host
            self.port = port
            self.timeout = timeout
            self.started_tls = False
            self.logged_in = None
            self.sent = None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            self.started_tls = True

        def login(self, username, password):
            self.logged_in = (username, password)

        def send_message(self, message):
            self.sent = message

    monkeypatch.setattr(settings, "EMAIL_FROM", "noreply@meetio.app")
    monkeypatch.setattr(settings, "MAILPIT_HOST", "localhost")
    monkeypatch.setattr(settings, "MAILPIT_PORT", 1025)
    monkeypatch.setattr(settings, "MAILPIT_USERNAME", None)
    monkeypatch.setattr(settings, "MAILPIT_PASSWORD", None)
    monkeypatch.setattr(settings, "MAILPIT_USE_TLS", False)
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)

    result = email_module._send_mailpit_email(
        to_email="person@example.com",
        subject="Test",
        html="<p>Hello</p>",
    )

    assert result["transport"] == "mailpit"
    assert result["to"] == "person@example.com"
    assert result["subject"] == "Test"
