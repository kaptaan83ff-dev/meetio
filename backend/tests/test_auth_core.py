from app.main import app
from app.models.user import User


def test_user_defaults_match_auth_schema_expectations():
    user = User(email="user@example.com", hashed_password="hashed-password", display_name="MeetIO User")

    assert user.id.startswith("usr_")
    assert user.providers == ["email"]
    assert user.totp_enabled is False
    assert user.totp_secret is None
    assert user.timezone == "UTC"
    assert user.language == "en"
    assert user.theme == "system"
    assert user.schema_version == 1
    assert user.email_notifications == {
        "meeting_recap_ready": True,
        "action_item_assigned": True,
        "action_item_due_reminder": True,
        "meeting_invite": True,
        "gcal_sync_failed": True,
    }


def test_auth_and_settings_routes_are_registered():
    paths = {route.path for route in app.routes}

    assert "/v1/auth/login" in paths
    assert "/v1/auth/logout" in paths
    assert "/v1/auth/register" in paths
    assert "/v1/auth/verify" in paths
    assert "/v1/auth/2fa/verify" in paths
    assert "/v1/auth/google/authorize" in paths
    assert "/v1/auth/google/callback" in paths
    assert "/v1/settings/2fa" in paths
