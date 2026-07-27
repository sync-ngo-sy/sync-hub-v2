from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, NoReturn

from sync_core import get_logger

if TYPE_CHECKING:
    from sync_worker.engine import QueueEngine

logger = get_logger(__name__)


async def consume(engine: QueueEngine[Any], *, interval: float, idle_max: float) -> NoReturn:
    idle_for = interval
    while True:
        try:
            worked = await engine.run_once()
        except Exception:
            logger.exception("worker.cycle_failed", queue=engine.queue.name)
            worked = False
        if worked:
            idle_for = interval
            continue
        await asyncio.sleep(idle_for)
        idle_for = min(idle_for * 2, idle_max)


async def sweep(engine: QueueEngine[Any], *, every: float) -> NoReturn:
    while True:
        await asyncio.sleep(every)
        try:
            await engine.sweep()
        except Exception:
            logger.exception("worker.sweep_failed", queue=engine.queue.name)
