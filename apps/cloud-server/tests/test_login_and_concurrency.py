import asyncio
import os
import uuid

import httpx
import pytest
from pydantic import SecretStr
from sqlalchemy import delete, func, select
from starlette.requests import Request
from starlette.responses import Response

if os.getenv("ARCMIND_RUN_DATABASE_TESTS") != "1":
    pytest.skip(
        "requires an explicitly provisioned PostgreSQL test database",
        allow_module_level=True,
    )

from arcmind_cloud import api
from arcmind_cloud.api import AuthContext, create_auth_session, create_text_turn
from arcmind_cloud.config import get_settings
from arcmind_cloud.database import session_factory
from arcmind_cloud.errors import ApiError
from arcmind_cloud.main import app
from arcmind_cloud.models import (
    AssistantResponse,
    AuthLoginAttempt,
    AuthSession,
    Conversation,
    Turn,
    User,
    utc_now,
)
from arcmind_cloud.schemas import LoginRequest, TextTurnCreate
from arcmind_cloud.security import hash_password


def login_request(source_ip: str = "127.0.0.11") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/session",
            "headers": [],
            "client": (source_ip, 12345),
        }
    )


async def reset_domain_data() -> None:
    async with session_factory() as database:
        await database.execute(delete(AuthLoginAttempt))
        await database.execute(delete(User))
        await database.commit()


@pytest.mark.asyncio
async def test_password_login_binds_the_existing_user_without_losing_data() -> None:
    await reset_domain_data()
    settings = get_settings()
    wrong_password = "wrong-password"  # noqa: S105
    test_password = "test-password"  # noqa: S105
    settings.login_password_hash = SecretStr(hash_password(test_password))
    async with session_factory() as database:
        legacy_user = User(email="legacy@example.invalid")
        database.add(legacy_user)
        await database.flush()
        conversation = Conversation(
            user_id=legacy_user.id,
            idempotency_key=f"legacy-{uuid.uuid4()}",
        )
        database.add(conversation)
        await database.commit()
        legacy_user_id = legacy_user.id
        conversation_id = conversation.id

    async with session_factory() as database:
        with pytest.raises(ApiError) as captured:
            await create_auth_session(
                LoginRequest(username=settings.login_username, password=wrong_password),  # noqa: S106
                login_request(),
                Response(),
                database,
                settings,
            )
    assert captured.value.code == "AUTH_INVALID_CREDENTIALS"

    response = Response()
    async with session_factory() as database:
        current_user = await create_auth_session(
            LoginRequest(username=settings.login_username, password=test_password),  # noqa: S106
            login_request(),
            response,
            database,
            settings,
        )

    async with session_factory() as database:
        bound_user = await database.get(User, legacy_user_id)
        preserved_conversation = await database.get(Conversation, conversation_id)
        session_count = await database.scalar(
            select(func.count())
            .select_from(AuthSession)
            .where(AuthSession.user_id == legacy_user_id)
        )
    assert current_user.id == legacy_user_id
    assert bound_user is not None
    assert bound_user.username == settings.login_username
    assert bound_user.password_digest == settings.effective_login_password_hash
    assert preserved_conversation is not None
    assert session_count == 1
    assert "__Host-arcmind_session=" in response.headers["set-cookie"]


@pytest.mark.asyncio
async def test_deployment_password_rotation_replaces_the_stored_digest() -> None:
    await reset_domain_data()
    settings = get_settings()
    old_password = "old-password"  # noqa: S105
    new_password = "new-password"  # noqa: S105
    old_digest = hash_password(old_password)
    new_digest = hash_password(new_password)
    async with session_factory() as database:
        user = User(
            username=settings.login_username,
            password_digest=old_digest,
        )
        database.add(user)
        await database.commit()
        user_id = user.id

    settings.login_password_hash = SecretStr(new_digest)
    async with session_factory() as database:
        await create_auth_session(
            LoginRequest(username=settings.login_username, password=new_password),  # noqa: S106
            login_request("127.0.0.12"),
            Response(),
            database,
            settings,
        )

    async with session_factory() as database:
        user = await database.get(User, user_id)
    assert user is not None
    assert user.password_digest == new_digest


@pytest.mark.asyncio
async def test_concurrent_correct_logins_create_one_user_and_distinct_sessions() -> None:
    await reset_domain_data()
    settings = get_settings()
    test_password = "test-password"  # noqa: S105
    settings.login_password_hash = SecretStr(hash_password(test_password))

    async def login(source_ip: str) -> object:
        async with session_factory() as database:
            return await create_auth_session(
                LoginRequest(username=settings.login_username, password=test_password),  # noqa: S106
                login_request(source_ip),
                Response(),
                database,
                settings,
            )

    users = await asyncio.gather(login("127.0.0.13"), login("127.0.0.14"))
    async with session_factory() as database:
        user_count = await database.scalar(select(func.count()).select_from(User))
        session_digests = (
            await database.scalars(select(AuthSession.token_digest).order_by(AuthSession.id))
        ).all()
    assert users[0].id == users[1].id  # type: ignore[union-attr]
    assert user_count == 1
    assert len(session_digests) == 2
    assert len(set(session_digests)) == 2


@pytest.mark.asyncio
async def test_ten_failed_logins_trigger_the_sliding_window_limit() -> None:
    await reset_domain_data()
    settings = get_settings()
    source_ip = "127.0.0.15"
    for _ in range(10):
        async with session_factory() as database:
            with pytest.raises(ApiError) as captured:
                await create_auth_session(
                    LoginRequest(
                        username=settings.login_username,
                        password="wrong-password",  # noqa: S106
                    ),
                    login_request(source_ip),
                    Response(),
                    database,
                    settings,
                )
        assert captured.value.code == "AUTH_INVALID_CREDENTIALS"

    async with session_factory() as database:
        with pytest.raises(ApiError) as captured:
            await create_auth_session(
                LoginRequest(
                    username=settings.login_username,
                    password="wrong-password",  # noqa: S106
                ),
                login_request(source_ip),
                Response(),
                database,
                settings,
            )
    assert captured.value.code == "RATE_LIMITED"
    assert captured.value.retry_after_seconds == 900


@pytest.mark.asyncio
async def test_http_login_sets_the_secure_cookie_and_restores_the_session() -> None:
    await reset_domain_data()
    settings = get_settings()
    test_password = "test-password"  # noqa: S105
    settings.login_password_hash = SecretStr(hash_password(test_password))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=settings.public_origin,
    ) as client:
        login_response = await client.post(
            "/api/v1/auth/session",
            headers={"Origin": settings.public_origin},
            json={"username": settings.login_username, "password": test_password},
        )
        current_user_response = await client.get("/api/v1/me")

    assert login_response.status_code == 200
    cookie = login_response.headers["set-cookie"]
    assert cookie.startswith("__Host-arcmind_session=")
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie
    assert "Domain=" not in cookie
    assert current_user_response.status_code == 200
    assert current_user_response.json()["id"] == login_response.json()["id"]


async def create_conversation_auth() -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    async with session_factory() as database:
        user = User(
            email=f"{uuid.uuid4()}@example.invalid",
            username=f"user-{uuid.uuid4().hex[:12]}",
            password_digest=get_settings().effective_login_password_hash,
        )
        database.add(user)
        await database.flush()
        conversation = Conversation(
            user_id=user.id,
            idempotency_key=f"conversation-{uuid.uuid4()}",
        )
        database.add(conversation)
        await database.flush()
        auth_session = AuthSession(
            user_id=user.id,
            token_digest=uuid.uuid4().hex,
            absolute_expires_at=utc_now(),
        )
        database.add(auth_session)
        await database.commit()
        return user.id, auth_session.id, conversation.id


async def submit_turn(
    user_id: uuid.UUID,
    auth_session_id: uuid.UUID,
    conversation_id: uuid.UUID,
    idempotency_key: str,
) -> object:
    async with session_factory() as database:
        user = await database.get(User, user_id)
        auth_session = await database.get(AuthSession, auth_session_id)
        assert user is not None and auth_session is not None
        try:
            return await create_text_turn(
                conversation_id,
                TextTurnCreate(content="并发消息"),
                idempotency_key,
                database,
                AuthContext(user=user, session=auth_session),
            )
        except ApiError as error:
            return error


@pytest.mark.asyncio
@pytest.mark.parametrize("same_key", [True, False])
async def test_concurrent_turns_are_idempotent_or_mutually_exclusive(
    monkeypatch: pytest.MonkeyPatch,
    same_key: bool,
) -> None:
    user_id, auth_session_id, conversation_id = await create_conversation_auth()
    job_ids = iter([uuid.uuid4().int % (2**62), uuid.uuid4().int % (2**62)])

    async def fake_enqueue_response(*_: object) -> int:
        return next(job_ids)

    monkeypatch.setattr(api, "enqueue_response", fake_enqueue_response)
    first_key = f"turn-{uuid.uuid4()}"
    second_key = first_key if same_key else f"turn-{uuid.uuid4()}"
    results = await asyncio.gather(
        submit_turn(user_id, auth_session_id, conversation_id, first_key),
        submit_turn(user_id, auth_session_id, conversation_id, second_key),
    )

    async with session_factory() as database:
        responses = (
            await database.scalars(
                select(AssistantResponse).where(
                    AssistantResponse.conversation_id == conversation_id
                )
            )
        ).all()
        turn_count = await database.scalar(
            select(func.count()).select_from(Turn).where(Turn.conversation_id == conversation_id)
        )
    assert len(responses) == 1
    assert turn_count == 1
    if same_key:
        assert all(not isinstance(result, ApiError) for result in results)
        assert results[0].response_id == results[1].response_id  # type: ignore[union-attr]
    else:
        errors = [result for result in results if isinstance(result, ApiError)]
        assert len(errors) == 1
        assert errors[0].code == "RESPONSE_IN_PROGRESS"
