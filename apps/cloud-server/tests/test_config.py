import pytest
from pydantic import SecretStr, ValidationError

from arcmind_cloud.config import Settings


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://arcmind:test@localhost/arcmind",
        "public_origin": "https://127.0.0.1",
        "login_username": "owner",
        "proof_secret": SecretStr("a" * 32),
    }
    values.update(overrides)
    return Settings(**values)  # pyright: ignore[reportArgumentType]


def test_empty_optional_credentials_are_normalized() -> None:
    config = settings(login_password_hash="", deepseek_api_key="")

    assert config.login_password_hash is None
    assert config.deepseek_api_key is None


def test_non_development_requires_password_hash() -> None:
    with pytest.raises(ValidationError):
        settings(environment="staging", login_password_hash=None)


def test_deepseek_endpoint_requires_https() -> None:
    with pytest.raises(ValidationError):
        settings(deepseek_base_url="http://api.deepseek.example")


def test_unknown_environment_fails_at_startup() -> None:
    with pytest.raises(ValidationError):
        settings(environment="prod")
