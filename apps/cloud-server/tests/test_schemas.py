import pytest
from pydantic import ValidationError

from arcmind_cloud.schemas import LoginRequest, TextTurnCreate


def test_login_requires_a_nontrivial_password() -> None:
    too_short = "short"
    with pytest.raises(ValidationError):
        LoginRequest(username="owner", password=too_short)  # noqa: S106


def test_public_models_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        TextTurnCreate(content="hello", hidden="not allowed")  # type: ignore[call-arg]
