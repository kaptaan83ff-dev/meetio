from pathlib import Path
import json
from typing import Optional
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find the project root directory (d:\MeetIO)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_CORS_ORIGINS: list[str] = Field(default_factory=list)
    
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
    EMAIL_TRANSPORT: str = "auto"
    RESEND_API_KEY: Optional[str] = ""
    EMAIL_FROM: str = "noreply@meetio.app"
    MAILPIT_HOST: str = "localhost"
    MAILPIT_PORT: int = 1025
    MAILPIT_USERNAME: Optional[str] = None
    MAILPIT_PASSWORD: Optional[str] = None
    MAILPIT_USE_TLS: bool = False
    
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

    @field_validator("FRONTEND_URL")
    @classmethod
    def frontend_url_valid(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("FRONTEND_URL must start with http:// or https://")
        return v.rstrip("/")

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def cors_origins_valid(cls, v):
        if v in (None, ""):
            return []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("EMAIL_TRANSPORT")
    @classmethod
    def email_transport_valid(cls, v: str) -> str:
        if v not in ["auto", "console", "mailpit", "resend"]:
            raise ValueError("EMAIL_TRANSPORT must be one of: auto, console, mailpit, resend")
        return v

    @model_validator(mode="after")
    def production_security_valid(self):
        if self.APP_ENV == "production":
            origins = [self.FRONTEND_URL, *self.BACKEND_CORS_ORIGINS]
            invalid_origins = [
                origin
                for origin in origins
                if origin.startswith("http://") or "localhost" in origin or "127.0.0.1" in origin
            ]
            if invalid_origins:
                raise ValueError("Production CORS/frontend origins must use HTTPS and cannot point to localhost.")
        return self

    @property
    def cors_allowed_origins(self) -> list[str]:
        origins = [
            self.FRONTEND_URL,
            *self.BACKEND_CORS_ORIGINS,
        ]
        if self.APP_ENV == "development":
            origins.extend(
                [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ]
            )
        return list(dict.fromkeys(origin.rstrip("/") for origin in origins if origin))

settings = Settings()
