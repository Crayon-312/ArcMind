import uuid
from typing import Any, cast

import procrastinate
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .generation import generate_response

settings = get_settings()
queue_database_url = settings.database_url.replace(
    "postgresql+psycopg://",
    "postgresql://",
    1,
)
queue_app = procrastinate.App(
    connector=procrastinate.PsycopgConnector(conninfo=queue_database_url)
)


@queue_app.task(
    name="arcmind.generate_response",
    queue="model",
    retry=procrastinate.RetryStrategy(
        max_attempts=3,
        wait=1,
        exponential_wait=2,
    ),
)
async def generate_response_job(response_id: str) -> None:
    await generate_response(uuid.UUID(response_id))


async def enqueue_response(database: AsyncSession, response_id: uuid.UUID) -> int:
    connection = await database.connection()
    sync_connection = cast(Any, connection.sync_connection)
    pool_connection = sync_connection.connection
    driver_connection = pool_connection.driver_connection
    lock = f"response:{response_id}"
    return await generate_response_job.configure(
        connection=driver_connection,
        lock=lock,
        queueing_lock=lock,
    ).defer_async(response_id=str(response_id))


async def cancel_response_job(job_id: int) -> None:
    async with queue_app.open_async():
        await queue_app.job_manager.cancel_job_by_id_async(job_id, abort=True)
