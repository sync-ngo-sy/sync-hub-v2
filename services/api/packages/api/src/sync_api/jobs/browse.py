from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Final

from sqlalchemy import ColumnElement, exists, func, literal_column, select

from sync_api.jobs.access import location_name, open_job, public_jobs
from sync_api.jobs.criteria import (
    languages_of,
    minimum_experience_of,
    public_questions_of,
    skills_of,
)
from sync_api.jobs.payload import PublicJob, PublicJobPage, PublicJobSummary, PublicTenant
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core import get_logger, transaction
from sync_core.models import EmploymentType, Job, JobViewEvent, Tenant, TrackedJobLink

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.jobs.visitors import Visitor

logger = get_logger(__name__)

#: Inlined, not bound: as a parameter it reaches the driver as a `regconfig` with no codec.
ENGLISH: Final[ColumnElement[str]] = literal_column("'english'")

#: How long one browser's readings of one Job through one channel count as the same view. A
#: refresh, a back button and a second look are the same interest, and counting each of them
#: would make "views" a measure of restlessness.
VIEW_WINDOW: Final = timedelta(minutes=30)


class JobBrowseService:
    """What an anonymous visitor can reach: published Jobs of active Tenants, and nothing else."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def page(
        self,
        *,
        keywords: str | None = None,
        location_key: str | None = None,
        employment_type: EmploymentType | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> PublicJobPage:
        query = public_jobs()
        if keywords:
            query = query.where(
                Job.search_vector.op("@@")(func.websearch_to_tsquery(ENGLISH, keywords))
            )
        if location_key:
            query = query.where(Job.location_key == location_key)
        if employment_type:
            query = query.where(Job.employment_type == employment_type)

        found = list(
            (
                await self._db.execute(
                    newest_first(
                        query, created_at=Job.created_at, id_=Job.id, cursor=cursor, limit=limit
                    )
                )
            ).tuples()
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return PublicJobPage(
            items=[_summary(job, tenant) for job, tenant in rows], next_cursor=next_cursor
        )

    async def job(self, job_id: UUID, visitor: Visitor) -> PublicJob:
        job, tenant = await open_job(self._db, job_id)
        await self._record_view(job.id, visitor, tracked_link_id=None)
        return await self._detail(job, tenant)

    async def by_link(self, token: str, visitor: Visitor) -> PublicJob:
        """A campaign landing. A link that has been turned off or has run out is simply gone."""
        link = await self._db.scalar(select(TrackedJobLink).where(TrackedJobLink.token == token))
        if link is None or not _usable(link):
            raise _dead_link()
        found = (
            (await self._db.execute(public_jobs().where(Job.id == link.job_id))).tuples().first()
        )
        if found is None:
            raise _dead_link()
        job, tenant = found
        await self._record_view(job.id, visitor, tracked_link_id=link.id)
        return await self._detail(job, tenant)

    async def _record_view(
        self, job_id: UUID, visitor: Visitor, *, tracked_link_id: UUID | None
    ) -> None:
        if await self._counted_recently(job_id, visitor, tracked_link_id):
            return
        async with transaction(self._db):
            self._db.add(
                JobViewEvent(
                    job_id=job_id,
                    tracked_link_id=tracked_link_id,
                    session_id=visitor.session_id,
                    visitor_hash=visitor.visitor_hash,
                )
            )
        logger.info(
            "jobs.viewed",
            job_id=str(job_id),
            tracked_link_id=None if tracked_link_id is None else str(tracked_link_id),
        )

    async def _counted_recently(
        self, job_id: UUID, visitor: Visitor, tracked_link_id: UUID | None
    ) -> bool:
        """Whether this browser is already counted for this Job through this channel.

        Per channel, not per Job: a visitor who reads a Job on the board and then follows a
        campaign link is a view the campaign brought, and swallowing it would both understate
        the link and lose the attribution an Application is later read from.

        The database's clock, so the window is measured from the instant the rows carry.
        """
        return bool(
            await self._db.scalar(
                select(
                    exists().where(
                        JobViewEvent.job_id == job_id,
                        JobViewEvent.session_id == visitor.session_id,
                        JobViewEvent.tracked_link_id.is_not_distinct_from(tracked_link_id),
                        JobViewEvent.viewed_at > func.now() - VIEW_WINDOW,
                    )
                )
            )
        )

    async def _detail(self, job: Job, tenant: Tenant) -> PublicJob:
        return PublicJob(
            **_summary(job, tenant).model_dump(),
            description=job.description,
            minimum_total_experience_years=minimum_experience_of(job),
            skills=await skills_of(self._db, job.id),
            languages=await languages_of(self._db, job.id),
            questions=await public_questions_of(self._db, job.id),
        )


def _dead_link() -> Problem:
    return Problem(
        status=404,
        type=TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
        detail="This link is not one the platform will follow.",
    )


def _usable(link: TrackedJobLink) -> bool:
    return link.is_active and (link.expires_at is None or link.expires_at > datetime.now(UTC))


def _cursor(row: tuple[Job, Tenant]) -> Cursor:
    job, _tenant = row
    return Cursor(created_at=job.created_at, id=job.id)


def _summary(job: Job, tenant: Tenant) -> PublicJobSummary:
    return PublicJobSummary(
        id=job.id,
        title=job.title,
        tenant=PublicTenant(name=tenant.name, slug=tenant.slug),
        location_key=job.location_key,
        location_name=location_name(job),
        employment_type=job.employment_type,
        work_mode=job.work_mode,
        expires_at=job.expires_at,
        created_at=job.created_at,
    )
