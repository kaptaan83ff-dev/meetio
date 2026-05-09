from pathlib import Path
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find the project root directory (d:\MeetIO)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str
    FRONTEND_URL: str = "http://localhost:5173"
    
    # MongoDB
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "meetio"
    
    # Redis
    REDIS_URL: str
    
    # JWT
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 240
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 15
    
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    
    # LiveKit
    LIVEKIT_URL: Optional[str] = None
    LIVEKIT_API_KEY: Optional[str] = None
    LIVEKIT_API_SECRET: Optional[str] = None
    
    # Deepgram
    DEEPGRAM_API_KEY: Optional[str] = ""
    
    # AI
    AI_PROVIDER: str = "openai" # openai | anthropic
    OPENAI_API_KEY: Optional[str] = ""
    ANTHROPIC_API_KEY: Optional[str] = ""
    
    # R2
    R2_ACCOUNT_ID: Optional[str] = ""
    R2_ACCESS_KEY_ID: Optional[str] = ""
    R2_SECRET_ACCESS_KEY: Optional[str] = ""
    R2_BUCKET_NAME: str = "meetio-recordings"
    R2_PUBLIC_URL: Optional[str] = ""
    
    # Email
    RESEND_API_KEY: Optional[str] = ""
    EMAIL_FROM: str = "noreply@meetio.app"
    
    # Meeting limits
    MEETING_MAX_PARTICIPANTS: int = 50

    model_config = SettingsConfigDict(
        env_file=ENV_PATH if ENV_PATH.exists() else None, 
        case_sensitive=True,
        extra="ignore"
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_strength(cls, v: str) -> str:
        if len(v) < 64:
            raise ValueError("SECRET_KEY must be at least 64 hex characters")
        return v

    @field_validator("APP_ENV")
    @classmethod
    def app_env_valid(cls, v: str) -> str:
        if v not in ["development", "staging", "production"]:
            raise ValueError("APP_ENV must be one of: development, staging, production")
        return v

settings = Settings()
