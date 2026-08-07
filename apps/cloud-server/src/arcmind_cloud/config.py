from functools import lru_cache
from typing import Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="ARCMIND_",
        extra="ignore",
    )

    environment: str = "development"
    database_url: str
    public_origin: str
    allowed_email: str
    proof_secret: SecretStr = Field(min_length=32)
    smtp_host: str = "mailpit"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_from: str = "ArcMind <no-reply@arcmind.invalid>"
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_starttls: bool = False
    smtp_ssl: bool = False
    smtp_timeout_seconds: float = Field(default=10, gt=0, le=60)
    deepseek_api_key: SecretStr | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_timeout_seconds: float = Field(default=60, gt=0, le=300)
    deterministic_chunk_delay_seconds: float = Field(default=0.15, ge=0, le=2)
    response_event_poll_seconds: float = Field(default=0.25, gt=0, le=2)
    response_heartbeat_seconds: float = Field(default=15, ge=5, le=60)
    cookie_secure: bool = True
    challenge_ttl_seconds: int = 600
    session_idle_seconds: int = 7 * 24 * 60 * 60
    session_absolute_seconds: int = 30 * 24 * 60 * 60

    @field_validator("allowed_email")
    @classmethod
    def normalize_allowed_email(cls, value: str) -> str:
        return value.strip().casefold()

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

    @field_validator("smtp_username", mode="before")
    @classmethod
    def normalize_optional_username(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

    @field_validator("smtp_password", "deepseek_api_key", mode="before")
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
    def validate_smtp_security(self) -> Self:
        if self.smtp_starttls and self.smtp_ssl:
            raise ValueError("smtp_starttls and smtp_ssl are mutually exclusive")
        if (self.smtp_username is None) != (self.smtp_password is None):
            raise ValueError("smtp_username and smtp_password must be configured together")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
