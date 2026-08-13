import asyncio
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Header, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings, get_settings
from .database import get_session, session_factory
from .errors import ApiError
from .generation import add_event
from .jobs import cancel_response_job, enqueue_response
from .models import (
    AssistantResponse,
    AuthLoginAttempt,
    AuthSession,
    ResponseEvent,
    User,
    utc_now,
)
from .models import (
    Conversation as ConversationModel,
)
from .models import (
    Turn as TurnModel,
)
from .schemas import (
    Conversation as ConversationSchema,
)
from .schemas import (
    ConversationCreate,
    ConversationDetail,
    CurrentUser,
    LoginRequest,
    ResponseAccepted,
    ResponseState,
    TextTurnCreate,
)
from .schemas import (
    Turn as TurnSchema,
)
from .security import (
    generate_session_token,
    session_digest,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
SettingsDependency = Annotated[Settings, Depends(get_settings)]
IdempotencyKey = Annotated[
    str,
    Header(alias="Idempotency-Key", min_length=8, max_length=128),
]


@dataclass(slots=True)
class AuthContext:
    user: User
    session: AuthSession


def current_user_dto(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        status="active",
        locale=user.locale,
        time_zone=user.time_zone,
        created_at=user.created_at,
    )


def conversation_dto(conversation: ConversationModel) -> ConversationSchema:
    return ConversationSchema(
        id=conversation.id,
        mode="text",
        state=conversation.state,  # type: ignore[arg-type]
        created_at=conversation.created_at,
        version=conversation.version,
    )


def source_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


async def authenticate_session(
    database: AsyncSession,
    settings: Settings,
    token: str | None,
) -> AuthContext:
    if not token:
        raise ApiError(401, "AUTH_SESSION_EXPIRED", "登录会话已失效，请重新登录。")

    digest = session_digest(settings, token)
    result = await database.execute(
        select(AuthSession, User)
        .join(User, User.id == AuthSession.user_id)
        .where(AuthSession.token_digest == digest)
    )
    row = result.one_or_none()
    if row is None:
        raise ApiError(401, "AUTH_SESSION_EXPIRED", "登录会话已失效，请重新登录。")

    auth_session, user = row
    now = utc_now()
    idle_deadline = auth_session.last_seen_at + timedelta(seconds=settings.session_idle_seconds)
    if (
        auth_session.state != "active"
        or now >= idle_deadline
        or now >= auth_session.absolute_expires_at
    ):
        auth_session.state = "expired"
        await database.commit()
        raise ApiError(401, "AUTH_SESSION_EXPIRED", "登录会话已失效，请重新登录。")

    auth_session.last_seen_at = now
    await database.commit()
    return AuthContext(user=user, session=auth_session)


async def require_auth(
    database: DatabaseSession,
    settings: SettingsDependency,
    token: Annotated[str | None, Cookie(alias="__Host-arcmind_session")] = None,
) -> AuthContext:
    return await authenticate_session(database, settings, token)


Auth = Annotated[AuthContext, Depends(require_auth)]


@router.post(
    "/auth/session",
    response_model=CurrentUser,
    operation_id="createAuthSession",
)
async def create_auth_session(
    payload: LoginRequest,
    request: Request,
    response: Response,
    database: DatabaseSession,
    settings: SettingsDependency,
) -> CurrentUser:
    username = payload.username.strip().casefold()
    ip = source_ip(request)
    await database.execute(select(func.pg_advisory_xact_lock(func.hashtext("arcmind:login-user"))))
    window_start = utc_now() - timedelta(minutes=15)
    failure_count = await database.scalar(
        select(func.count())
        .select_from(AuthLoginAttempt)
        .where(AuthLoginAttempt.source_ip == ip, AuthLoginAttempt.created_at >= window_start)
    )
    if (failure_count or 0) >= 10:
        raise ApiError(
            429,
            "RATE_LIMITED",
            "请求过于频繁，请稍后重试。",
            retryable=True,
            retry_after_seconds=900,
        )
    await database.execute(
        delete(AuthLoginAttempt).where(AuthLoginAttempt.created_at < window_start)
    )

    user = await database.scalar(
        select(User).where(User.username == username).with_for_update()
    )
    if user is None and username == settings.login_username:
        user = await database.scalar(
            select(User)
            .where(User.username.is_(None))
            .order_by(User.created_at, User.id)
            .limit(1)
            .with_for_update()
        )
    encoded = settings.effective_login_password_hash
    credentials_valid = username == settings.login_username and verify_password(
        payload.password, encoded
    )
    if not credentials_valid:
        database.add(AuthLoginAttempt(source_ip=ip))
        await database.commit()
        raise ApiError(401, "AUTH_INVALID_CREDENTIALS", "账号或密码错误。")

    if user is None:
        user = User(username=settings.login_username, password_digest=encoded)
        database.add(user)
        await database.flush()
    if user.username is None:
        user.username = settings.login_username
    if user.password_digest != encoded:
        user.password_digest = encoded
    now = utc_now()
    raw_token = generate_session_token()
    auth_session = AuthSession(
        user_id=user.id,
        token_digest=session_digest(settings, raw_token),
        absolute_expires_at=now + timedelta(seconds=settings.session_absolute_seconds),
    )
    database.add(auth_session)
    await database.commit()
    response.set_cookie(
        key="__Host-arcmind_session",
        value=raw_token,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=settings.session_absolute_seconds,
    )
    return current_user_dto(user)


@router.get("/me", response_model=CurrentUser, operation_id="getCurrentUser")
async def get_current_user(auth: Auth) -> CurrentUser:
    return current_user_dto(auth.user)


@router.delete(
    "/auth/sessions/current",
    status_code=204,
    operation_id="revokeCurrentSession",
)
async def revoke_current_session(
    response: Response,
    database: DatabaseSession,
    auth: Auth,
) -> None:
    auth.session.state = "revoked"
    auth.session.revoked_at = utc_now()
    await database.commit()
    response.delete_cookie("__Host-arcmind_session", path="/")


@router.delete("/auth/sessions", status_code=204, operation_id="revokeAllSessions")
async def revoke_all_sessions(
    response: Response,
    database: DatabaseSession,
    auth: Auth,
) -> None:
    now = utc_now()
    await database.execute(
        update(AuthSession)
        .where(AuthSession.user_id == auth.user.id, AuthSession.state == "active")
        .values(state="revoked", revoked_at=now)
    )
    await database.commit()
    response.delete_cookie("__Host-arcmind_session", path="/")


@router.post(
    "/conversations",
    response_model=ConversationSchema,
    status_code=201,
    operation_id="createConversation",
)
async def create_conversation(
    payload: ConversationCreate,
    idempotency_key: IdempotencyKey,
    database: DatabaseSession,
    auth: Auth,
) -> ConversationSchema:
    conversation_id = uuid.uuid4()
    await database.execute(
        insert(ConversationModel)
        .values(
            id=conversation_id,
            user_id=auth.user.id,
            idempotency_key=idempotency_key,
            mode=payload.mode,
            state="active",
            version=1,
            created_at=utc_now(),
        )
        .on_conflict_do_nothing(index_elements=["user_id", "idempotency_key"])
    )
    await database.commit()
    conversation = await database.scalar(
        select(ConversationModel).where(
            ConversationModel.user_id == auth.user.id,
            ConversationModel.idempotency_key == idempotency_key,
        )
    )
    if conversation is None:
        raise RuntimeError("conversation upsert did not produce a row")
    return conversation_dto(conversation)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetail,
    operation_id="getConversation",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    database: DatabaseSession,
    auth: Auth,
) -> ConversationDetail:
    conversation = await database.scalar(
        select(ConversationModel).where(
            ConversationModel.id == conversation_id,
            ConversationModel.user_id == auth.user.id,
        )
    )
    if conversation is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "没有找到对应资源。")
    turns = (
        await database.scalars(
            select(TurnModel)
            .where(TurnModel.conversation_id == conversation.id)
            .order_by(TurnModel.created_at, TurnModel.id)
        )
    ).all()
    return ConversationDetail(
        **conversation_dto(conversation).model_dump(),
        turns=[
            TurnSchema(
                id=turn.id,
                role=turn.role,  # type: ignore[arg-type]
                content=turn.content,
                finality="final",
                created_at=turn.created_at,
            )
            for turn in turns
        ],
    )


@router.post(
    "/conversations/{conversation_id}/turns",
    response_model=ResponseAccepted,
    status_code=202,
    operation_id="createTextTurn",
)
async def create_text_turn(
    conversation_id: uuid.UUID,
    payload: TextTurnCreate,
    idempotency_key: IdempotencyKey,
    database: DatabaseSession,
    auth: Auth,
) -> ResponseAccepted:
    conversation = await database.scalar(
        select(ConversationModel)
        .where(
            ConversationModel.id == conversation_id,
            ConversationModel.user_id == auth.user.id,
        )
        .with_for_update()
    )
    if conversation is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "没有找到对应资源。")

    existing = await database.scalar(
        select(AssistantResponse).where(
            AssistantResponse.user_id == auth.user.id,
            AssistantResponse.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        return ResponseAccepted(
            response_id=existing.id,
            event_stream_url=f"/api/v1/responses/{existing.id}/events",
        )

    in_progress = await database.scalar(
        select(AssistantResponse).where(
            AssistantResponse.conversation_id == conversation.id,
            AssistantResponse.state.in_(["queued", "generating"]),
        )
    )
    if in_progress is not None:
        raise ApiError(409, "RESPONSE_IN_PROGRESS", "当前回复尚未结束，请稍后再试。")

    user_turn = TurnModel(
        conversation_id=conversation.id,
        role="user",
        content=payload.content,
    )
    database.add(user_turn)
    await database.flush()
    assistant_response = AssistantResponse(
        conversation_id=conversation.id,
        user_id=auth.user.id,
        user_turn_id=user_turn.id,
        idempotency_key=idempotency_key,
    )
    database.add(assistant_response)
    await database.flush()
    try:
        assistant_response.job_id = await enqueue_response(database, assistant_response.id)
    except Exception as error:
        await database.rollback()
        logger.exception(
            "response enqueue failed",
            extra={"response_id": str(assistant_response.id)},
        )
        raise ApiError(
            503,
            "QUEUE_UNAVAILABLE",
            "回复服务暂时不可用，请稍后重试。",
            retryable=True,
        ) from error
    await database.commit()
    return ResponseAccepted(
        response_id=assistant_response.id,
        event_stream_url=f"/api/v1/responses/{assistant_response.id}/events",
    )


def response_event_text(event: ResponseEvent) -> str:
    envelope = {
        "event_id": str(event.id),
        "event_type": event.event_type,
        "response_id": str(event.response_id),
        "sequence": event.sequence,
        "occurred_at": event.occurred_at.astimezone(UTC).isoformat(),
        "payload": event.payload,
    }
    return (
        f"id: {event.id}\n"
        f"event: {event.event_type}\n"
        f"data: {json.dumps(envelope, ensure_ascii=False)}\n\n"
    )


@router.get(
    "/responses/{response_id}/events",
    operation_id="streamResponseEvents",
)
async def stream_response_events(
    response_id: uuid.UUID,
    settings: SettingsDependency,
    token: Annotated[str | None, Cookie(alias="__Host-arcmind_session")] = None,
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
) -> StreamingResponse:
    async with session_factory() as database:
        auth = await authenticate_session(database, settings, token)
        assistant_response = await database.scalar(
            select(AssistantResponse).where(
                AssistantResponse.id == response_id,
                AssistantResponse.user_id == auth.user.id,
            )
        )
    if assistant_response is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "没有找到对应资源。")
    session_id = auth.session.id

    async def event_stream() -> AsyncIterator[str]:
        last_sequence = 0
        terminal_events = {
            "response.completed",
            "response.failed",
            "response.cancelled",
        }
        if last_event_id:
            async with session_factory() as stream_database:
                snapshot = await stream_database.scalar(
                    select(ResponseEvent)
                    .where(
                        ResponseEvent.response_id == response_id,
                        ResponseEvent.event_type == "response.snapshot",
                    )
                    .order_by(ResponseEvent.sequence.desc())
                    .limit(1)
                )
                if snapshot is not None:
                    yield response_event_text(snapshot)
                    last_sequence = snapshot.sequence
                else:
                    try:
                        cursor_id = uuid.UUID(last_event_id)
                    except ValueError:
                        cursor_id = None
                    if cursor_id is not None:
                        cursor = await stream_database.scalar(
                            select(ResponseEvent).where(
                                ResponseEvent.id == cursor_id,
                                ResponseEvent.response_id == response_id,
                            )
                        )
                        if cursor is not None:
                            last_sequence = cursor.sequence

        heartbeat_at = time.monotonic()
        while True:
            async with session_factory() as stream_database:
                session_state = await stream_database.scalar(
                    select(AuthSession.state).where(AuthSession.id == session_id)
                )
                if session_state != "active":
                    return
                current_state = await stream_database.scalar(
                    select(AssistantResponse.state).where(
                        AssistantResponse.id == response_id
                    )
                )
                events = (
                    await stream_database.scalars(
                        select(ResponseEvent)
                        .where(
                            ResponseEvent.response_id == response_id,
                            ResponseEvent.sequence > last_sequence,
                        )
                        .order_by(ResponseEvent.sequence)
                    )
                ).all()

            for event in events:
                last_sequence = event.sequence
                heartbeat_at = time.monotonic()
                yield response_event_text(event)
                if event.event_type in terminal_events:
                    return

            if not events and current_state in {"completed", "failed", "cancelled"}:
                return
            now = time.monotonic()
            if now - heartbeat_at >= settings.response_heartbeat_seconds:
                envelope = {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "heartbeat",
                    "response_id": str(response_id),
                    "sequence": last_sequence,
                    "occurred_at": utc_now().astimezone(UTC).isoformat(),
                    "payload": {
                        "server_time": utc_now().astimezone(UTC).isoformat(),
                    },
                }
                yield (
                    "event: heartbeat\n"
                    f"data: {json.dumps(envelope, ensure_ascii=False)}\n\n"
                )
                heartbeat_at = now
            await asyncio.sleep(settings.response_event_poll_seconds)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/responses/{response_id}/cancel",
    response_model=ResponseState,
    operation_id="cancelResponse",
)
async def cancel_response(
    response_id: uuid.UUID,
    _idempotency_key: IdempotencyKey,
    database: DatabaseSession,
    auth: Auth,
) -> ResponseState:
    assistant_response = await database.scalar(
        select(AssistantResponse)
        .where(
            AssistantResponse.id == response_id,
            AssistantResponse.user_id == auth.user.id,
        )
        .with_for_update()
    )
    if assistant_response is None:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "没有找到对应资源。")
    if assistant_response.state in {"queued", "generating"}:
        assistant_response.state = "cancelled"
        assistant_response.version += 1
        await add_event(
            database,
            assistant_response.id,
            "response.cancelled",
            {
                "cancelled_by": "user",
                "response_version": assistant_response.version,
            },
        )
        await database.commit()
        if assistant_response.job_id is not None:
            try:
                await cancel_response_job(assistant_response.job_id)
            except Exception:
                logger.exception(
                    "response job cancellation failed",
                    extra={"response_id": str(assistant_response.id)},
                )
    return ResponseState(
        response_id=assistant_response.id,
        state=assistant_response.state,  # type: ignore[arg-type]
        version=assistant_response.version,
    )
