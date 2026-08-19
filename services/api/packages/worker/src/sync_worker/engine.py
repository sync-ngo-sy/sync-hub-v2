from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, Protocol

from sqlalchemy import func, or_, select, update

from sync_core import get_logger, transaction
from sync_core.profile import CONTROL_CHARACTERS

if TYPE_CHECKING:
    from collections.abc import Mapping
    from enum import Enum
    from uuid import UUID

    from sqlalchemy import ColumnElement, Table, Update
    from sqlalchemy.ext.asyncio import AsyncSession
    from structlog.stdlib import BoundLogger

    from sync_core import Database

logger = get_logger(__name__)

#: Enough to recognize a failure from the row, without a stack trace's worth of text.
MAX_ERROR_LENGTH = 500

#: Bounded: the sweep holds every row it touches locked until it commits, so one
#: unbounded transaction over a post-outage backlog is worse than a slow recovery.
SWEEP_BATCH = 100


class PermanentFailureError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class Queue:
    name: str
    table: Table
    pending: Enum
    processing: Enum
    completed: Enum
    failed: Enum
    #: Narrows a shared table to the rows this consumer can actually do something with, so
    #: the ones it cannot are left waiting rather than claimed and buried.
    mine: tuple[ColumnElement[bool], ...] = ()


@dataclass(frozen=True, slots=True)
class ClaimedJob:
    id: UUID
    attempts: int
    row: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    max_attempts: int
    backoff_seconds: float
    stuck_after_seconds: float

    def delay_after(self, attempts: int) -> timedelta:
        return timedelta(seconds=self.backoff_seconds * 2 ** max(attempts - 1, 0))

    def is_exhausted(self, attempts: int) -> bool:
        return attempts >= self.max_attempts

    @property
    def stuck_before(self) -> datetime:
        return datetime.now(UTC) - timedelta(seconds=self.stuck_after_seconds)


class Consumer[ResultT](Protocol):
    @property
    def queue(self) -> Queue: ...

    async def perform(self, job: ClaimedJob) -> ResultT: ...

    async def record(self, session: AsyncSession, job: ClaimedJob, result: ResultT) -> None: ...

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None: ...


class QueueEngine[ResultT]:
    def __init__(
        self, database: Database, consumer: Consumer[ResultT], policy: RetryPolicy
    ) -> None:
        self._database = database
        self._consumer = consumer
        self._policy = policy

    @property
    def queue(self) -> Queue:
        return self._consumer.queue

    @property
    def name(self) -> str:
        return self.queue.name

    async def run_once(self) -> bool:
        job = await self._claim()
        if job is None:
            return False

        log = logger.bind(queue=self.queue.name, job_id=str(job.id), attempt=job.attempts)
        try:
            result = await self._consumer.perform(job)
        except Exception as error:
            await self._failed(job, error, log)
        else:
            await self._completed(job, result, log)
        return True

    async def sweep(self) -> int:
        table = self.queue.table
        swept = 0
        async with self._database.session() as session, transaction(session):
            stuck = await session.execute(
                select(table)
                .where(
                    table.c.status == self.queue.processing,
                    table.c.started_at < self._policy.stuck_before,
                    *self.queue.mine,
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
                    await session.execute(self._dead(job, reason))
                else:
                    await session.execute(self._requeue(job, reason))
                swept += 1

        if swept:
            logger.warning("worker.jobs_swept", queue=self.queue.name, count=swept)
        return swept

    async def _claim(self) -> ClaimedJob | None:
        table = self.queue.table
        oldest_available = (
            select(table.c.id)
            .where(
                table.c.status == self.queue.pending,
                or_(table.c.available_at.is_(None), table.c.available_at <= func.now()),
                *self.queue.mine,
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

    async def _completed(self, job: ClaimedJob, result: ResultT, log: BoundLogger) -> None:
        """The queue row first, and the consumer's own write only if that row was still ours.

        This order is the whole guarantee: a parse recorded before the claim is checked is a
        parse that lands whatever the queue says, and for a CV that reads as a Candidate whose
        profile silently moved backwards.
        """
        table = self.queue.table
        async with self._database.session() as session, transaction(session):
            claimed = await session.execute(
                update(table)
                .where(*self._claim_held(job))
                .values(
                    status=self.queue.completed,
                    completed_at=func.now(),
                    error_message=None,
                )
                .returning(table.c.id)
            )
            if claimed.one_or_none() is None:
                log.warning("worker.claim_lost")
                return
            await self._consumer.record(session, job, result)
        log.info("worker.job_completed")

    async def _failed(self, job: ClaimedJob, error: Exception, log: BoundLogger) -> None:
        reason = failure_reason(error)
        permanent = isinstance(error, PermanentFailureError)
        settled = permanent or self._policy.is_exhausted(job.attempts)
        async with self._database.session() as session, transaction(session):
            written = await session.execute(
                self._dead(job, reason) if settled else self._requeue(job, reason)
            )
            if written.one_or_none() is None:
                log.warning("worker.claim_lost", error=reason)
                return
            if settled:
                await self._consumer.give_up(session, job, reason)

        log.warning(
            "worker.job_failed",
            settled=settled,
            permanent=permanent,
            error=reason,
            exc_info=None if settled else error,
        )

    def _claim_held(self, job: ClaimedJob) -> tuple[ColumnElement[bool], ...]:
        """The row exactly as the claim left it.

        A job that outruns the stuck threshold is swept and claimed by a second worker, so
        writing by id alone lets the first worker's eventual answer overwrite state the second
        one owns. Every settle asserts this instead, and discards its result when it fails.
        """
        table = self.queue.table
        return (
            table.c.id == job.id,
            table.c.status == self.queue.processing,
            table.c.started_at == job.row["started_at"],
            table.c.attempts == job.attempts,
        )

    def _dead(self, job: ClaimedJob, reason: str) -> Update:
        table = self.queue.table
        return (
            update(table)
            .where(*self._claim_held(job))
            .values(status=self.queue.failed, completed_at=func.now(), error_message=reason)
            .returning(table.c.id)
        )

    def _requeue(self, job: ClaimedJob, reason: str) -> Update:
        table = self.queue.table
        return (
            update(table)
            .where(*self._claim_held(job))
            .values(
                status=self.queue.pending,
                available_at=datetime.now(UTC) + self._policy.delay_after(job.attempts),
                started_at=None,
                error_message=reason,
            )
            .returning(table.c.id)
        )


def failure_reason(error: Exception) -> str:
    """`error_message` is a text column and an exception's text is not always ours — a model's
    refusal of a CV reaches here verbatim — so a control character is taken out of it first."""
    described = f"{type(error).__name__}: {error}" if str(error) else type(error).__name__
    return CONTROL_CHARACTERS.sub("", described)[:MAX_ERROR_LENGTH]
