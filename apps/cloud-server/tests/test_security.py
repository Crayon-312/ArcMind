from pydantic import SecretStr

from arcmind_cloud.config import Settings
from arcmind_cloud.security import (
    constant_time_equal,
    generate_session_token,
    hash_password,
    session_digest,
    verify_password,
)


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://arcmind:test@localhost/arcmind",
        "public_origin": "https://127.0.0.1",
        "login_username": "Owner ",
        "proof_secret": SecretStr("a" * 32),
    }
    values.update(overrides)
    return Settings(**values)  # pyright: ignore[reportArgumentType]


def test_proofs_are_scoped_and_plain_values_are_not_retained() -> None:
    config = settings()
    session = session_digest(config, "123456")

    assert "123456" not in session
    assert constant_time_equal(session, session_digest(config, "123456"))


def test_generated_session_token_has_required_shape() -> None:
    assert len(generate_session_token()) >= 43


def test_login_username_is_normalized() -> None:
    assert settings().login_username == "owner"


def test_password_hash_round_trip_and_wrong_password() -> None:
    encoded = hash_password("correct horse battery staple", salt=b"fixed-test-salt!")

    assert "correct horse battery staple" not in encoded
    assert verify_password("correct horse battery staple", encoded)
    assert not verify_password("wrong password", encoded)
    assert not verify_password("anything", "invalid")
    assert not verify_password("anything", encoded.replace("16384", "1048576", 1))


def test_development_password_hash_matches_the_documented_local_password() -> None:
    config = settings(login_password_hash=None)

    assert verify_password("arcmind-dev", config.effective_login_password_hash)
    assert not verify_password("wrong-password", config.effective_login_password_hash)
