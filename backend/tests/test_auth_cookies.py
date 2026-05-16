from app.auth.backend import cookie_transport
from app.config import settings


def test_auth_cookie_secure_matches_environment():
    assert cookie_transport.cookie_secure is (settings.APP_ENV != "development")
