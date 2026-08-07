from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
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
    smtp_port: int = 1025
    smtp_from: str = "ArcMind <no-reply@arcmind.invalid>"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
