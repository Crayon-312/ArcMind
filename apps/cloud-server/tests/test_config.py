import pytest
from pydantic import SecretStr, ValidationError

from arcmind_cloud.config import Settings


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://arcmind:test@localhost/arcmind",
        "public_origin": "https://127.0.0.1",
        "allowed_email": "owner@example.invalid",
        "proof_secret": SecretStr("a" * 32),
    }
    values.update(overrides)
    return Settings(**values)  # pyright: ignore[reportArgumentType]


def test_empty_optional_credentials_are_normalized() -> None:
    config = settings(smtp_username="", smtp_password="", deepseek_api_key="")

    assert config.smtp_username is None
    assert config.smtp_password is None
    assert config.deepseek_api_key is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"smtp_starttls": True, "smtp_ssl": True},
        {"smtp_username": "owner"},
        {"smtp_password": SecretStr("smtp-secret")},
    ],
)
def test_invalid_smtp_security_configuration_fails_at_startup(
    overrides: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        settings(**overrides)


def test_deepseek_endpoint_requires_https() -> None:
    with pytest.raises(ValidationError):
        settings(deepseek_base_url="http://api.deepseek.example")
