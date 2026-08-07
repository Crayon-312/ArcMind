import asyncio
import time
import uuid
from collections.abc import AsyncIterator
from typing import Protocol

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .adapters import DeterministicModelProvider, ModelProviderError
from .config import get_settings
from .database import session_factory
from .models import (
    AssistantResponse,
    Conversation,
    ResponseEvent,
    Turn,
    utc_now,
)


class StreamingModel(Protocol):
    def stream(self, content: str) -> AsyncIterator[str]: ...


async def next_event_sequence(database: AsyncSession, response_id: uuid.UUID) -> int:
    current = await database.scalar(
        select(func.max(ResponseEvent.sequence)).where(
            ResponseEvent.response_id == response_id
        )
    )
    return (current or 0) + 1


async def add_event(
    database: AsyncSession,
    response_id: uuid.UUID,
    event_type: str,
    payload: dict[str, object],
) -> None:
    database.add(
        ResponseEvent(
            response_id=response_id,
            sequence=await next_event_sequence(database, response_id),
            event_type=event_type,
            payload=payload,
        )
    )


async def fail_response(
    database: AsyncSession,
    response: AssistantResponse,
    *,
    error_code: str,
    retryable: bool,
) -> None:
    if response.state not in {"queued", "generating"}:
        return
    response.state = "failed"
    response.version += 1
    response.error_code = error_code
    response.retryable = retryable
    await add_event(
        database,
        response.id,
        "response.failed",
        {
            "error_code": error_code,
            "retryable": retryable,
            "correlation_id": uuid.uuid4().hex,
        },
    )


async def begin_generation(response_id: uuid.UUID) -> str | None:
    async with session_factory() as database:
        response = await database.scalar(
            select(AssistantResponse)
            .where(AssistantResponse.id == response_id)
            .with_for_update()
        )
        if response is None or response.state in {"completed", "failed", "cancelled"}:
            return None
        if response.state == "generating":
            await fail_response(
                database,
                response,
                error_code="GENERATION_INTERRUPTED",
                retryable=True,
            )
            await database.commit()
            return None

        user_turn = await database.scalar(
            select(Turn).where(
                Turn.id == response.user_turn_id,
                Turn.role == "user",
            )
        )
        if user_turn is None:
            await fail_response(
                database,
                response,
                error_code="GENERATION_INPUT_UNAVAILABLE",
                retryable=False,
            )
            await database.commit()
            return None

        response.state = "generating"
        await add_event(database, response.id, "response.started", {})
        await database.commit()
        return user_turn.content


async def append_delta(
    response_id: uuid.UUID,
    *,
    full_text: str,
    chunk: str,
    snapshot_version: int | None,
) -> bool:
    async with session_factory() as database:
        response = await database.scalar(
            select(AssistantResponse)
            .where(AssistantResponse.id == response_id)
            .with_for_update()
        )
        if response is None or response.state != "generating":
            return False

        response.snapshot_text = full_text
        await add_event(database, response.id, "response.delta", {"text": chunk})
        if snapshot_version is not None:
            await add_event(
                database,
                response.id,
                "response.snapshot",
                {
                    "text": full_text,
                    "snapshot_version": snapshot_version,
                },
            )
        await database.commit()
        return True


async def complete_response(
    response_id: uuid.UUID,
    *,
    full_text: str,
    snapshot_version: int,
) -> None:
    async with session_factory() as database:
        response = await database.scalar(
            select(AssistantResponse)
            .where(AssistantResponse.id == response_id)
            .with_for_update()
        )
        if response is None or response.state != "generating":
            return

        conversation = await database.scalar(
            select(Conversation)
            .where(Conversation.id == response.conversation_id)
            .with_for_update()
        )
        if conversation is None:
            await fail_response(
                database,
                response,
                error_code="GENERATION_CONVERSATION_UNAVAILABLE",
                retryable=False,
            )
            await database.commit()
            return

        response.snapshot_text = full_text
        await add_event(
            database,
            response.id,
            "response.snapshot",
            {
                "text": full_text,
                "snapshot_version": snapshot_version,
            },
        )
        assistant_turn = Turn(
            conversation_id=conversation.id,
            role="assistant",
            content=full_text,
        )
        database.add(assistant_turn)
        await database.flush()
        response.state = "completed"
        response.version += 1
        response.completed_at = utc_now()
        conversation.version += 1
        await add_event(
            database,
            response.id,
            "response.completed",
            {
                "turn_id": str(assistant_turn.id),
                "response_version": response.version,
            },
        )
        await database.commit()


async def record_provider_failure(
    response_id: uuid.UUID,
    *,
    error_code: str,
    retryable: bool,
) -> None:
    async with session_factory() as database:
        response = await database.scalar(
            select(AssistantResponse)
            .where(AssistantResponse.id == response_id)
            .with_for_update()
        )
        if response is None:
            return
        await fail_response(
            database,
            response,
            error_code=error_code,
            retryable=retryable,
        )
        await database.commit()


async def generate_response(
    response_id: uuid.UUID,
    *,
    provider: StreamingModel | None = None,
) -> None:
    content = await begin_generation(response_id)
    if content is None:
        return

    settings = get_settings()
    active_provider = provider or DeterministicModelProvider(
        chunk_delay_seconds=settings.deterministic_chunk_delay_seconds
    )
    full_text = ""
    snapshot_version = 0
    snapshot_length = 0
    snapshot_at = time.monotonic()

    try:
        async for chunk in active_provider.stream(content):
            if not chunk:
                continue
            full_text += chunk
            now = time.monotonic()
            should_snapshot = (
                len(full_text) - snapshot_length >= 256
                or now - snapshot_at >= 0.5
            )
            if should_snapshot:
                snapshot_version += 1
            accepted = await append_delta(
                response_id,
                full_text=full_text,
                chunk=chunk,
                snapshot_version=snapshot_version if should_snapshot else None,
            )
            if not accepted:
                return
            if should_snapshot:
                snapshot_length = len(full_text)
                snapshot_at = now

        if not full_text:
            await record_provider_failure(
                response_id,
                error_code="MODEL_INVALID_RESPONSE",
                retryable=False,
            )
            return
        await complete_response(
            response_id,
            full_text=full_text,
            snapshot_version=snapshot_version + 1,
        )
    except ModelProviderError as error:
        await record_provider_failure(
            response_id,
            error_code=f"MODEL_{error.category.upper()}",
            retryable=error.retryable,
        )
    except asyncio.CancelledError:
        await record_provider_failure(
            response_id,
            error_code="GENERATION_INTERRUPTED",
            retryable=True,
        )
        raise
