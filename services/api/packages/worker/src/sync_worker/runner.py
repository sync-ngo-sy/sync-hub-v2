from __future__ import annotations

import asyncio
from typing import NoReturn, Protocol

from sync_core import get_logger

logger = get_logger(__name__)


class Drainable(Protocol):
    @property
    def name(self) -> str: ...

    async def run_once(self) -> bool: ...

    async def sweep(self) -> int: ...


async def consume(engine: Drainable, *, interval: float, idle_max: float) -> NoReturn:
    idle_for = interval
    while True:
        try:
            worked = await engine.run_once()
        except Exception:
            logger.exception("worker.cycle_failed", queue=engine.name)
            worked = False
        if worked:
            idle_for = interval
            continue
        await asyncio.sleep(idle_for)
        idle_for = min(idle_for * 2, idle_max)


async def sweep(engine: Drainable, *, every: float) -> NoReturn:
    while True:
        await asyncio.sleep(every)
        try:
            await engine.sweep()
        except Exception:
            logger.exception("worker.sweep_failed", queue=engine.name)
