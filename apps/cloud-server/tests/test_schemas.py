import pytest
from pydantic import ValidationError

from arcmind_cloud.schemas import AuthChallengeVerification, TextTurnCreate


def test_verification_code_requires_six_digits() -> None:
    with pytest.raises(ValidationError):
        AuthChallengeVerification(code="12345a")


def test_public_models_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        TextTurnCreate(content="hello", hidden="not allowed")  # type: ignore[call-arg]
