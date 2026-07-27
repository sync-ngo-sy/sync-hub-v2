"""Claiming work off a Postgres table queue, and recording how it went.

ADR-0003 puts every async workload on a typed Postgres table rather than a broker, so this
is the whole consumer side of that decision: the `FOR UPDATE SKIP LOCKED` claim, the
`attempts`/`available_at` backoff, and the sweep that rescues a job whose worker died. CV
ingestion is the first user; `communications` is the same table shape and reuses this
untouched.

**The transaction boundaries are the design.** A cycle is three of them, not one, and the
split is what keeps a ten-second model call from being a ten-second open transaction:

1. *Claim* — one short write, committed immediately, so the row is visibly `processing` and
   no other worker will take it.
2. *Perform* — the slow part, holding no transaction at all. The consumer opens its own
   sessions for whatever it needs to read.
3. *Record* — the consumer's own writes and the job's outcome, in one transaction. Together
   deliberately: a CV that has been marked `ready` and a job still queued would be parsed
   twice, and each parse costs a model call.

`candidate_embedding_jobs` deliberately does not fit here. It is coalesced — one row per
candidate, with `dirty`/`revision` instead of `attempts` — and supabase ADR-0002 gives it
its own contract; bending this engine into covering both would make neither clear.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, Protocol

from sqlalchemy import func, or_, select, update

from sync_core import get_logger, transaction

if TYPE_CHECKING:
    from collections.abc import Mapping
    from enum import Enum
    from uuid import UUID

    from sqlalchemy import Table, Update
    from sqlalchemy.ext.asyncio import AsyncSession
    from structlog.stdlib import BoundLogger

    from sync_core import Database

logger = get_logger(__name__)

#: How much of a failure reaches `error_message`. Enough to recognize what went wrong from
#: a row; not so much that a stack trace's worth of text lands in every retried job.
MAX_ERROR_LENGTH = 500

#: Stuck jobs rescued per sweep. Bounded because the sweep holds every row it touches
#: locked until it commits: after a long outage the backlog could be thousands, and one
#: unbounded transaction over all of them is a much worse problem than a slow recovery.
#: The sweep runs on a timer, so a backlog simply drains over several passes.
SWEEP_BATCH = 100


class PermanentFailureError(Exception):
    """Raise from `perform` for work that will fail the same way every time.

    The job dies now rather than after exhausting its attempts. A consumer decides this,
    not the engine: only the consumer knows that an unreadable CV is settled while a
    provider timeout is not.
    """


@dataclass(frozen=True, slots=True)
class Queue:
    """One attempt-based queue table, described to the engine.

    Core `Table` rather than the ORM class deliberately. The engine touches only the five
    columns every one of these queues has, and naming them as columns is what lets one
    implementation serve tables whose other columns have nothing in common.
    """

    name: str
    table: Table
    pending: Enum
    processing: Enum
    completed: Enum
    failed: Enum


@dataclass(frozen=True, slots=True)
class ClaimedJob:
    """A queue row this worker has taken, as it looked the moment it was taken."""

    id: UUID
    #: Including this one. A job on its first attempt arrives here with `attempts == 1`.
    attempts: int
    row: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    """How hard to try, how long to wait, and when to call a worker dead."""

    max_attempts: int
    backoff_seconds: float
    stuck_after_seconds: float

    def delay_after(self, attempts: int) -> timedelta:
        """Doubling, from the base delay — the usual answer to "is it back yet?"."""
        return timedelta(seconds=self.backoff_seconds * 2 ** max(attempts - 1, 0))

    def is_exhausted(self, attempts: int) -> bool:
        return attempts >= self.max_attempts

    @property
    def stuck_before(self) -> datetime:
        """The moment a claim older than which belongs to a worker that is not coming back."""
        return datetime.now(UTC) - timedelta(seconds=self.stuck_after_seconds)


class Consumer[ResultT](Protocol):
    """The three things the engine needs a queue's work to be split into.

    Three rather than one because of where the transactions go: `perform` is slow and holds
    none, `record` and `give_up` are quick and are committed with the job's own outcome.
    """

    @property
    def queue(self) -> Queue:
        """The table this consumer drains."""

    async def perform(self, job: ClaimedJob) -> ResultT:
        """The actual work, outside any transaction of the engine's.

        Raise `PermanentFailureError` for work that cannot succeed; anything else is
        retried until the attempts run out.
        """

    async def record(self, session: AsyncSession, job: ClaimedJob, result: ResultT) -> None:
        """Write what `perform` produced. Committed with the job's completion, or not at all."""

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None:
        """Say so in the domain: this job is dead and whatever was waiting on it must be told.

        Committed with the job's dead state, so nothing can observe a failed job whose CV
        still claims to be processing.
        """


class QueueEngine[ResultT]:
    """Runs one consumer against one queue."""

    def __init__(
        self, database: Database, consumer: Consumer[ResultT], policy: RetryPolicy
    ) -> None:
        self._database = database
        self._consumer = consumer
        self._policy = policy

    @property
    def queue(self) -> Queue:
        return self._consumer.queue

    async def run_once(self) -> bool:
        """Claim one job and see it through. False when there was nothing to claim.

        The caller decides what an empty queue means — the poll loop sleeps on it, and a
        test uses it to drive exactly one cycle and then assert on what changed.
        """
        job = await self._claim()
        if job is None:
            return False

        log = logger.bind(queue=self.queue.name, job_id=str(job.id), attempt=job.attempts)
        try:
            result = await self._consumer.perform(job)
        except Exception as error:  # a consumer's failure is data, not a crash
            await self._failed(job, error, log)
        else:
            await self._completed(job, result)
            log.info("worker.job_completed")
        return True

    async def sweep(self) -> int:
        """Rescue jobs left `processing` by a worker that died. Returns how many.

        The in-worker half of ADR-0003's amendment: no `pg_cron`, so every worker sweeps
        periodically and `SKIP LOCKED` keeps them from sweeping the same row twice.

        A stuck job that still has attempts left goes back to `pending` and is picked up
        immediately. One that does not is finished off here — otherwise a job whose worker
        died on its last attempt would sit in `processing` for good, and so would the CV
        waiting on it.

        At most `SWEEP_BATCH` per pass, oldest claim first.
        """
        table = self.queue.table
        swept = 0
        async with self._database.session() as session, transaction(session):
            # Whole rows, not just the two columns this decides on: a job it buries goes to
            # `give_up`, and a consumer needs the same row there as after a live failure —
            # `cv_id`, for one, is how the ingestion consumer knows which CV to fail.
            stuck = await session.execute(
                select(table)
                .where(
                    table.c.status == self.queue.processing,
                    table.c.started_at < self._policy.stuck_before,
                )
                .order_by(table.c.started_at)
                .limit(SWEEP_BATCH)
                .with_for_update(skip_locked=True)
            )
            for row in stuck.mappings().all():
                job = ClaimedJob(id=row["id"], attempts=row["attempts"], row=dict(row))
                reason = f"the worker holding this job stopped responding (attempt {job.attempts})"
                if self._policy.is_exhausted(job.attempts):
                    await self._consumer.give_up(session, job, reason)
                    await session.execute(self._dead(job.id, reason))
                else:
                    await session.execute(self._requeue(job.id, job.attempts, reason))
                swept += 1

        if swept:
            logger.warning("worker.jobs_swept", queue=self.queue.name, count=swept)
        return swept

    async def _claim(self) -> ClaimedJob | None:
        """Take the oldest job nothing else is holding, and mark it taken.

        One statement, so the read and the mark cannot come apart: `SKIP LOCKED` steps over
        rows another worker has locked in its own claim rather than queueing behind them,
        which is what lets several workers drain one queue without coordinating.
        """
        table = self.queue.table
        oldest_available = (
            select(table.c.id)
            .where(
                table.c.status == self.queue.pending,
                or_(table.c.available_at.is_(None), table.c.available_at <= func.now()),
            )
            .order_by(table.c.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
            .scalar_subquery()
        )
        async with self._database.session() as session, transaction(session):
            claimed = await session.execute(
                update(table)
                .where(table.c.id == oldest_available)
                .values(
                    status=self.queue.processing,
                    started_at=func.now(),
                    attempts=table.c.attempts + 1,
                    error_message=None,
                )
                .returning(*table.c)
            )
            row = claimed.mappings().one_or_none()

        if row is None:
            return None
        return ClaimedJob(id=row["id"], attempts=row["attempts"], row=dict(row))

    async def _completed(self, job: ClaimedJob, result: ResultT) -> None:
        table = self.queue.table
        async with self._database.session() as session, transaction(session):
            await self._consumer.record(session, job, result)
            await session.execute(
                update(table)
                .where(table.c.id == job.id)
                .values(
                    status=self.queue.completed,
                    completed_at=func.now(),
                    error_message=None,
                )
            )

    async def _failed(self, job: ClaimedJob, error: Exception, log: BoundLogger) -> None:
        """Retry it, or bury it — and either way say why in the row.

        The consumer's `give_up` runs in the burial's own transaction, which is the whole
        reason the engine calls it rather than leaving the consumer to notice.
        """
        reason = _reason(error)
        permanent = isinstance(error, PermanentFailureError)
        settled = permanent or self._policy.is_exhausted(job.attempts)
        async with self._database.session() as session, transaction(session):
            if settled:
                await self._consumer.give_up(session, job, reason)
                await session.execute(self._dead(job.id, reason))
            else:
                await session.execute(self._requeue(job.id, job.attempts, reason))

        log.warning(
            "worker.job_failed",
            settled=settled,
            permanent=permanent,
            error=reason,
            exc_info=None if settled else error,
        )

    def _dead(self, job_id: UUID, reason: str) -> Update:
        table = self.queue.table
        return (
            update(table)
            .where(table.c.id == job_id)
            .values(status=self.queue.failed, completed_at=func.now(), error_message=reason)
        )

    def _requeue(self, job_id: UUID, attempts: int, reason: str) -> Update:
        table = self.queue.table
        return (
            update(table)
            .where(table.c.id == job_id)
            .values(
                status=self.queue.pending,
                available_at=datetime.now(UTC) + self._policy.delay_after(attempts),
                started_at=None,
                error_message=reason,
            )
        )


def _reason(error: Exception) -> str:
    """A failure as a sentence for `error_message`, never as a stack trace.

    The type is included because the message alone is often a bare provider string, and
    the row is the only place someone reading the queue can tell a refusal from an outage.
    """
    described = f"{type(error).__name__}: {error}" if str(error) else type(error).__name__
    return described[:MAX_ERROR_LENGTH]
