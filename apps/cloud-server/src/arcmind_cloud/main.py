import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from .api import router
from .config import get_settings
from .database import engine
from .errors import ApiError
from .schemas import ApiErrorBody, ErrorEnvelope

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
settings = get_settings()
app = FastAPI(title="ArcMind Cloud API", version="0.1.0", docs_url=None, redoc_url=None)
app.include_router(router)


@app.middleware("http")
async def request_context(
    request: Request,
    call_next: RequestResponseEndpoint,
) -> Response:
    correlation_id = request.headers.get("x-correlation-id") or uuid.uuid4().hex
    request.state.correlation_id = correlation_id
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin is not None and origin.rstrip("/") != settings.public_origin:
            error = ErrorEnvelope(
                error=ApiErrorBody(
                    code="RESOURCE_NOT_FOUND",
                    message="请求来源不可用。",
                    retryable=False,
                    correlation_id=correlation_id,
                )
            )
            return JSONResponse(status_code=403, content=error.model_dump(exclude_none=True))
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response


@app.exception_handler(ApiError)
async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", uuid.uuid4().hex)
    body = ErrorEnvelope(
        error=ApiErrorBody(
            code=exc.code,
            message=exc.message,
            retryable=exc.retryable,
            retry_after_seconds=exc.retry_after_seconds,
            correlation_id=correlation_id,
        )
    )
    return JSONResponse(status_code=exc.status_code, content=body.model_dump(exclude_none=True))


@app.get("/health/live")
async def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
async def ready() -> dict[str, str]:
    async with engine.connect() as connection:
        await connection.execute(text("select 1"))
    return {"status": "ready"}
