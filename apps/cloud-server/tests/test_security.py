import uuid
from unittest.mock import patch

from pydantic import SecretStr

from arcmind_cloud.api import select_challenge_code
from arcmind_cloud.config import Settings
from arcmind_cloud.security import (
    challenge_digest,
    constant_time_equal,
    generate_code,
    generate_session_token,
    session_digest,
)


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://arcmind:test@localhost/arcmind",
        "public_origin": "https://127.0.0.1",
        "allowed_email": "Owner@Example.invalid ",
        "proof_secret": SecretStr("a" * 32),
    }
    values.update(overrides)
    return Settings(**values)  # pyright: ignore[reportArgumentType]


def test_proofs_are_scoped_and_plain_values_are_not_retained() -> None:
    config = settings()
    challenge_id = uuid.uuid4()
    challenge = challenge_digest(config, challenge_id, "123456")
    session = session_digest(config, "123456")

    assert challenge != session
    assert "123456" not in challenge
    assert constant_time_equal(challenge, challenge_digest(config, challenge_id, "123456"))


def test_generated_credentials_have_required_shape() -> None:
    assert generate_code().isdigit()
    assert len(generate_code()) == 6
    assert len(generate_session_token()) >= 43


def test_allowed_email_is_normalized() -> None:
    assert settings().allowed_email == "owner@example.invalid"


def test_development_uses_the_explicit_fixed_code_without_delivery() -> None:
    code, should_deliver = select_challenge_code(settings())

    assert code == "123456"
    assert should_deliver is False


def test_staging_uses_a_generated_code_with_delivery() -> None:
    with patch("arcmind_cloud.api.generate_code", return_value="654321"):
        code, should_deliver = select_challenge_code(settings(environment="staging"))

    assert code == "654321"
    assert should_deliver is True
