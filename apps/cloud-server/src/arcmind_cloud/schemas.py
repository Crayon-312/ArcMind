import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AuthChallengeRequest(StrictModel):
    email: EmailStr


class AuthChallengeAccepted(StrictModel):
    challenge_id: uuid.UUID
    expires_in_seconds: Literal[600] = 600
    message: str = Field(max_length=200)


class AuthChallengeVerification(StrictModel):
    code: str = Field(pattern=r"^[0-9]{6}$")


class CurrentUser(StrictModel):
    id: uuid.UUID
    status: Literal["active"]
    locale: str
    time_zone: str
    created_at: datetime


class ConversationCreate(StrictModel):
    mode: Literal["text"]


class Conversation(StrictModel):
    id: uuid.UUID
    mode: Literal["text", "realtime_voice"]
    state: Literal["active", "ended"]
    created_at: datetime
    version: int = Field(ge=1)


class TextTurnCreate(StrictModel):
    content: str = Field(min_length=1, max_length=20_000)


class Turn(StrictModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=200_000)
    finality: Literal["final"]
    created_at: datetime


class ConversationDetail(Conversation):
    turns: list[Turn]


class ResponseAccepted(StrictModel):
    response_id: uuid.UUID
    state: Literal["queued"] = "queued"
    event_stream_url: str


class ResponseState(StrictModel):
    response_id: uuid.UUID
    state: Literal["queued", "generating", "completed", "failed", "cancelled"]
    version: int = Field(ge=1)


class ApiErrorBody(StrictModel):
    code: str
    message: str
    retryable: bool
    correlation_id: str
    retry_after_seconds: int | None = None


class ErrorEnvelope(StrictModel):
    error: ApiErrorBody
