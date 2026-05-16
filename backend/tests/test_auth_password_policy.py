import pytest

from fastapi_users.exceptions import InvalidPasswordException

from app.auth.manager import UserManager
from app.models.user import User


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("password", "expected_reason"),
    [
        ("sh1A!", "Password must be at least 8 characters long."),
        ("lowercase12!", "Password must include at least one uppercase letter."),
        ("NoDigitsHere!", "Password must include at least one number."),
        ("Password123", "Password must include at least one special character."),
    ],
)
async def test_validate_password_rejects_weak_passwords(password, expected_reason):
    user_manager = UserManager(object())
    user = User(email="user@example.com", hashed_password="hashed-password", display_name="MeetIO User")

    with pytest.raises(InvalidPasswordException) as exc_info:
        await user_manager.validate_password(password, user)

    assert exc_info.value.reason == expected_reason


@pytest.mark.asyncio
async def test_validate_password_accepts_a_strong_password():
    user_manager = UserManager(object())
    user = User(email="user@example.com", hashed_password="hashed-password", display_name="MeetIO User")

    await user_manager.validate_password("Password123!", user)
