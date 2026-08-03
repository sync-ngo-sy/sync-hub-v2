from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Protocol

from sync_core import get_logger

logger = get_logger(__name__)


class Drainable(Protocol):
    @property
    def name(self) -> str: ...

    async def run_once(self) -> bool: ...

    async def sweep(self) -> int: ...


@dataclass(frozen=True, slots=True)
class DrainReport:
    """What one invocation did. Returned to the caller so a schedule can be audited."""

    processed: dict[str, int] = field(default_factory=dict)
    swept: dict[str, int] = field(default_factory=dict)
    #: Queues that hit the row bound and so may still have work. The next call picks it up.
    truncated: list[str] = field(default_factory=list)

    @property
    def total_processed(self) -> int:
        return sum(self.processed.values())

    @property
    def total_swept(self) -> int:
        return sum(self.swept.values())


async def drain_queue(engine: Drainable, *, concurrency: int, max_rows: int) -> tuple[int, bool]:
    """Claim and process until the queue is empty. Returns (processed, hit_the_bound).

    Bounded because this runs inside a request: without a ceiling a continuously fed queue
    would keep one invocation alive until the platform killed it mid-job. Stopping early is
    safe — the schedule calls again, and nothing is lost.
    """
    remaining = max_rows
    truncated = False
    processed = 0

    async def drainer() -> int:
        nonlocal remaining, truncated
        count = 0
        while True:
            if remaining <= 0:
                truncated = True
                return count
            remaining -= 1
            try:
                worked = await engine.run_once()
            except Exception:
                # A failing job is the engine's business and never reaches here; this is the
                # infrastructure underneath giving way, so stop this drainer and let the
                # others finish. The schedule retries.
                logger.exception("worker.drain_failed", queue=engine.name)
                return count
            if not worked:
                return count
            count += 1

    counts = await asyncio.gather(*(drainer() for _ in range(concurrency)))
    processed = sum(counts)
    return processed, truncated
