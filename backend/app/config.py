from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal

class Settings(BaseSettings):
    # App config
    APP_ENV: Literal["development", "staging", "production"] = "development"
    SECRET_KEY: str
    FRONTEND_URL: str = "http://localhost:5173"
    
    # MongoDB
    MONGODB_URI: str
    MONGODB_DB_NAME: str = "meetio"
    
    # Redis
    REDIS_URL: str
    
    # JWT
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 240 # 4 hours
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 15
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    
    # LiveKit
    LIVEKIT_URL: str
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    
    # Deepgram
    DEEPGRAM_API_KEY: str
    
    # AI Pipeline
    AI_PROVIDER: Literal["openai", "anthropic"] = "openai"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    # Cloudflare R2
    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_BUCKET_NAME: str = "meetio-recordings"
    R2_PUBLIC_URL: str
    
    # Email (Resend)
    RESEND_API_KEY: str
    EMAIL_FROM: str = "noreply@meetio.app"
    
    # OTP
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    
    # Meeting Limits
    MAX_PARTICIPANTS_PER_MEETING: int = 50

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore" # Ignore extra env vars
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) != 64:
            raise ValueError("SECRET_KEY must be exactly 64 hex characters")
        try:
            int(v, 16)
        except ValueError:
            raise ValueError("SECRET_KEY must be a valid hex string")
        return v

# Singleton instance
settings = Settings()
