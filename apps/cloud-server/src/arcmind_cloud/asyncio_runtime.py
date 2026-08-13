import asyncio
import os
import selectors
from collections.abc import Coroutine
from typing import Any


def run[Result](coroutine: Coroutine[Any, Any, Result]) -> Result:
    if os.name == "nt":
        with asyncio.Runner(
            loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector())
        ) as runner:
            return runner.run(coroutine)
    return asyncio.run(coroutine)
