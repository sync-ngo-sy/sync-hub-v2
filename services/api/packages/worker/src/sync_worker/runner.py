"""Turning a `QueueEngine` into something that keeps running.

ADR-0003's amendment chose polling over `LISTEN/NOTIFY`: at this load a sub-second pickup
is indistinguishable from a notification, and it costs neither a dedicated listener
connection nor the reconnect handling one needs. The price is a query per queue per
interval while nothing is happening, which is what the idle backoff is for — an empty
queue is asked less and less often, up to a ceiling, and goes back to eager the moment it
yields work.

Neither loop ever exits on its own. A failure that reaches here is the database being
unreachable or a bug in the engine, and in both cases the answer is to log it and try
again rather than to quietly stop draining a queue. Shutdown is cancellation, from
`sync_worker.worker`.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, NoReturn

from sync_core import get_logger

if TYPE_CHECKING:
    from sync_worker.engine import QueueEngine

logger = get_logger(__name__)


async def consume(engine: QueueEngine[Any], *, interval: float, idle_max: float) -> NoReturn:
    """Claim and run jobs, one after another, for as long as the process lives.

    A cycle that found work is followed immediately by another, so a burst of uploads is
    drained at the speed of the work rather than one per interval.
    """
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
    """Requeue jobs abandoned by a dead worker, on a timer.

    Sleeps first: at startup every `processing` row is either genuinely in flight elsewhere
    or too young to be judged, so sweeping immediately can only find nothing.
    """
    while True:
        await asyncio.sleep(every)
        try:
            await engine.sweep()
        except Exception:
            logger.exception("worker.sweep_failed", queue=engine.queue.name)
