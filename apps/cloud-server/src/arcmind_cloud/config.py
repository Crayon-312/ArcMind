from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="ARCMIND_",
        extra="ignore",
    )

    environment: Literal["development", "staging", "production"] = "development"
    database_url: str
    runtime_database_password: SecretStr | None = None
    public_origin: str
    login_username: str = "owner"
    login_password_hash: SecretStr | None = None
    proof_secret: SecretStr = Field(min_length=32)
    deepseek_api_key: SecretStr | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_timeout_seconds: float = Field(default=60, gt=0, le=300)
    deterministic_chunk_delay_seconds: float = Field(default=0.15, ge=0, le=2)
    response_event_poll_seconds: float = Field(default=0.25, gt=0, le=2)
    response_heartbeat_seconds: float = Field(default=15, ge=5, le=60)
    cookie_secure: bool = True
    session_idle_seconds: int = 7 * 24 * 60 * 60
    session_absolute_seconds: int = 30 * 24 * 60 * 60

    @field_validator("login_username")
    @classmethod
    def normalize_login_username(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if not 3 <= len(normalized) <= 64:
            raise ValueError("login_username must contain 3 to 64 characters")
        return normalized

    @field_validator("database_url")
    @classmethod
    def require_postgresql(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("database_url must use postgresql+psycopg")
        return value

    @field_validator("public_origin")
    @classmethod
    def normalize_origin(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator(
        "login_password_hash", "runtime_database_password", "deepseek_api_key", mode="before"
    )
    @classmethod
    def normalize_optional_secret(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("deepseek_base_url")
    @classmethod
    def normalize_deepseek_base_url(cls, value: str) -> str:
        normalized = value.rstrip("/")
        if not normalized.startswith("https://"):
            raise ValueError("deepseek_base_url must use https")
        return normalized

    @model_validator(mode="after")
    def validate_login_security(self) -> Self:
        if self.environment != "development" and self.login_password_hash is None:
            raise ValueError("login_password_hash is required outside development")
        return self

    @property
    def effective_login_password_hash(self) -> str:
        if self.login_password_hash is not None:
            return self.login_password_hash.get_secret_value()
        # Development-only hash for the documented local password: arcmind-dev
        return "scrypt$16384$8$1$YXJjbWluZC1kZXYtc2FsdA$lkBOAEn-nRXjkKXpgKRp1Hm1oSjdUQX-1TgEI8vLqs8"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
