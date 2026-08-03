"""Drain semantics, without a database.

The engines are the real ones' shape — `Drainable` — with the work replaced by a counter, so
these cover termination, bounding and coalescing rather than SQL.
"""

from __future__ import annotations

import asyncio

from sync_worker.runner import drain_queue


class FakeQueue:
    """A queue of `depth` rows. run_once claims one and reports whether it got any."""

    def __init__(self, name: str, depth: int, *, delay: float = 0) -> None:
        self.name = name
        self.remaining = depth
        self.delay = delay
        self.claims = 0
        self.concurrent = 0
        self.peak_concurrent = 0

    async def run_once(self) -> bool:
        self.concurrent += 1
        self.peak_concurrent = max(self.peak_concurrent, self.concurrent)
        try:
            if self.delay:
                await asyncio.sleep(self.delay)
            if self.remaining <= 0:
                return False
            self.remaining -= 1
            self.claims += 1
            return True
        finally:
            self.concurrent -= 1

    async def sweep(self) -> int:
        return 0


async def test_draining_terminates_when_the_queue_is_empty() -> None:
    queue = FakeQueue("ingestion", depth=7)

    processed, truncated = await drain_queue(queue, concurrency=3, max_rows=100)

    assert (processed, truncated) == (7, False)
    assert queue.remaining == 0


async def test_an_empty_queue_costs_one_look_per_drainer() -> None:
    queue = FakeQueue("ingestion", depth=0)

    processed, truncated = await drain_queue(queue, concurrency=4, max_rows=100)

    assert (processed, truncated) == (0, False)


async def test_the_row_bound_stops_a_queue_that_keeps_filling() -> None:
    queue = FakeQueue("ingestion", depth=1_000)

    processed, truncated = await drain_queue(queue, concurrency=2, max_rows=10)

    assert truncated is True
    assert processed <= 10
    assert queue.remaining > 0


async def test_drainers_work_in_parallel_so_a_burst_coalesces() -> None:
    queue = FakeQueue("ingestion", depth=12, delay=0.01)

    processed, _ = await drain_queue(queue, concurrency=4, max_rows=100)

    assert processed == 12
    assert queue.peak_concurrent > 1


async def test_a_failing_queue_stops_that_drainer_without_failing_the_drain() -> None:
    class Broken(FakeQueue):
        async def run_once(self) -> bool:
            raise RuntimeError("the database went away")

    broken = Broken("ingestion", depth=3)

    processed, truncated = await drain_queue(broken, concurrency=2, max_rows=5)

    assert (processed, truncated) == (0, False)
