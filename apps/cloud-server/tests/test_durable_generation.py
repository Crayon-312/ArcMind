import os
import uuid
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import func, select, text

if os.getenv("ARCMIND_RUN_DATABASE_TESTS") != "1":
    pytest.skip(
        "requires an explicitly provisioned PostgreSQL test database",
        allow_module_level=True,
    )

from arcmind_cloud.adapters import ModelProviderError
from arcmind_cloud.api import AuthContext, cancel_response
from arcmind_cloud.database import session_factory
from arcmind_cloud.generation import generate_response
from arcmind_cloud.jobs import enqueue_response, queue_app
from arcmind_cloud.models import (
    AssistantResponse,
    AuthSession,
    Conversation,
    ResponseEvent,
    Turn,
    User,
    utc_now,
)


class FakeStreamingProvider:
    async def stream(self, content: str) -> AsyncIterator[str]:
        del content
        yield "第一段"
        yield "第二段"


class FailingStreamingProvider:
    async def stream(self, content: str) -> AsyncIterator[str]:
        del content
        yield "暂存内容"
        raise ModelProviderError("timeout", retryable=True)


async def create_queued_response(
    *,
    state: str = "queued",
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    async with session_factory() as database:
        user = User(email=f"{uuid.uuid4()}@example.invalid")
        database.add(user)
        await database.flush()
        conversation = Conversation(
            user_id=user.id,
            idempotency_key=str(uuid.uuid4()),
        )
        database.add(conversation)
        await database.flush()
        user_turn = Turn(
            conversation_id=conversation.id,
            role="user",
            content="测试耐久生成",
        )
        database.add(user_turn)
        await database.flush()
        response = AssistantResponse(
            conversation_id=conversation.id,
            user_id=user.id,
            user_turn_id=user_turn.id,
            idempotency_key=str(uuid.uuid4()),
            state=state,
        )
        database.add(response)
        await database.commit()
        return response.id, conversation.id, user.id


@pytest.mark.asyncio
async def test_enqueue_uses_the_domain_transaction() -> None:
    async with session_factory() as database:
        user = User(email=f"{uuid.uuid4()}@example.invalid")
        database.add(user)
        await database.flush()
        conversation = Conversation(
            user_id=user.id,
            idempotency_key=str(uuid.uuid4()),
        )
        database.add(conversation)
        await database.flush()
        user_turn = Turn(
            conversation_id=conversation.id,
            role="user",
            content="事务回滚",
        )
        database.add(user_turn)
        await database.flush()
        response = AssistantResponse(
            conversation_id=conversation.id,
            user_id=user.id,
            user_turn_id=user_turn.id,
            idempotency_key=str(uuid.uuid4()),
        )
        database.add(response)
        await database.flush()

        job_id = await enqueue_response(database, response.id)
        await database.rollback()

    async with session_factory() as database:
        job_count = await database.scalar(
            text("SELECT count(*) FROM procrastinate_jobs WHERE id = :job_id"),
            {"job_id": job_id},
        )
        response_count = await database.scalar(
            select(func.count())
            .select_from(AssistantResponse)
            .where(AssistantResponse.id == response.id)
        )
    assert job_count == 0
    assert response_count == 0


@pytest.mark.asyncio
async def test_worker_completes_a_durable_response() -> None:
    response_id, conversation_id, _ = await create_queued_response()
    async with session_factory() as database:
        response = await database.get(AssistantResponse, response_id)
        assert response is not None
        response.job_id = await enqueue_response(database, response.id)
        await database.commit()

    async with queue_app.open_async():
        await queue_app.run_worker_async(
            queues=["model"],
            wait=False,
            concurrency=1,
            listen_notify=False,
            delete_jobs="never",
        )

    async with session_factory() as database:
        response = await database.get(AssistantResponse, response_id)
        events = (
            await database.scalars(
                select(ResponseEvent)
                .where(ResponseEvent.response_id == response_id)
                .order_by(ResponseEvent.sequence)
            )
        ).all()
        assistant_turns = (
            await database.scalars(
                select(Turn).where(
                    Turn.conversation_id == conversation_id,
                    Turn.role == "assistant",
                )
            )
        ).all()
    assert response is not None
    assert response.state == "completed"
    assert [event.event_type for event in events][0] == "response.started"
    assert [event.event_type for event in events][-1] == "response.completed"
    assert any(event.event_type == "response.delta" for event in events)
    assert len(assistant_turns) == 1
    assert assistant_turns[0].content == response.snapshot_text


@pytest.mark.asyncio
async def test_provider_failure_is_a_stable_terminal_fact() -> None:
    response_id, _, _ = await create_queued_response()

    await generate_response(response_id, provider=FailingStreamingProvider())

    async with session_factory() as database:
        response = await database.get(AssistantResponse, response_id)
        event = await database.scalar(
            select(ResponseEvent).where(
                ResponseEvent.response_id == response_id,
                ResponseEvent.event_type == "response.failed",
            )
        )
    assert response is not None
    assert response.state == "failed"
    assert response.error_code == "MODEL_TIMEOUT"
    assert response.retryable is True
    assert event is not None
    assert event.payload["error_code"] == "MODEL_TIMEOUT"


@pytest.mark.asyncio
async def test_interrupted_generation_becomes_retryable_failure() -> None:
    response_id, _, _ = await create_queued_response(state="generating")

    await generate_response(response_id, provider=FakeStreamingProvider())

    async with session_factory() as database:
        response = await database.get(AssistantResponse, response_id)
    assert response is not None
    assert response.state == "failed"
    assert response.error_code == "GENERATION_INTERRUPTED"
    assert response.retryable is True


@pytest.mark.asyncio
async def test_cancel_is_idempotent_and_prevents_late_completion() -> None:
    response_id, _, user_id = await create_queued_response()
    async with session_factory() as database:
        user = await database.get(User, user_id)
        assert user is not None
        auth_session = AuthSession(
            user_id=user.id,
            token_digest=uuid.uuid4().hex,
            absolute_expires_at=utc_now(),
        )
        database.add(auth_session)
        await database.commit()
        auth = AuthContext(user=user, session=auth_session)

        first = await cancel_response(
            response_id,
            "cancel-key-1",
            database,
            auth,
        )
        second = await cancel_response(
            response_id,
            "cancel-key-2",
            database,
            auth,
        )

    await generate_response(response_id, provider=FakeStreamingProvider())

    async with session_factory() as database:
        cancel_count = await database.scalar(
            select(func.count())
            .select_from(ResponseEvent)
            .where(
                ResponseEvent.response_id == response_id,
                ResponseEvent.event_type == "response.cancelled",
            )
        )
        response = await database.get(AssistantResponse, response_id)
    assert first.state == "cancelled"
    assert second.state == "cancelled"
    assert cancel_count == 1
    assert response is not None
    assert response.state == "cancelled"
