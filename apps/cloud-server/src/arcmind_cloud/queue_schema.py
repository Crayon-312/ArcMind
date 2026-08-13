from .asyncio_runtime import run
from .jobs import queue_app


async def apply_queue_schema() -> None:
    async with queue_app.open_async():
        await queue_app.schema_manager.apply_schema_async()


if __name__ == "__main__":
    run(apply_queue_schema())
