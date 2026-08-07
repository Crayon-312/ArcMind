import uuid

from pydantic import SecretStr

from arcmind_cloud.config import Settings
from arcmind_cloud.security import (
    challenge_digest,
    constant_time_equal,
    generate_code,
    generate_session_token,
    session_digest,
)


def settings() -> Settings:
    return Settings(
        database_url="postgresql+psycopg://arcmind:test@localhost/arcmind",
        public_origin="https://127.0.0.1",
        allowed_email="Owner@Example.invalid ",
        proof_secret=SecretStr("a" * 32),
    )


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
