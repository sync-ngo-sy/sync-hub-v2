from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from sqlalchemy import ColumnElement, Select, func, literal, literal_column, or_, select, tuple_

from sync_api.jobs.criteria import languages_of, public_questions_of, skills_of
from sync_api.jobs.payload import JobPublisher, PublicJob, PublicJobPage, PublicJobSummary
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor
from sync_api.problems import (
    JOB_NOT_FOUND_PROBLEM_TYPE,
    TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.models import Job, JobStatus, JobViewEvent, Tenant, TrackedJobLink

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.jobs.visitors import Visitor

logger = get_logger(__name__)

#: Inlined, not bound: as a parameter it reaches the driver as a `regconfig` with no codec.
ENGLISH: Final[ColumnElement[str]] = literal_column("'english'")


class JobBrowseService:
    """What an anonymous visitor can reach: published Jobs of active Tenants, and nothing else."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def page(
        self,
        *,
        keywords: str | None = None,
        location: str | None = None,
        employment_type: str | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> PublicJobPage:
        query = _public_jobs().order_by(Job.created_at.desc(), Job.id.desc()).limit(limit + 1)
        if keywords:
            query = query.where(
                Job.search_vector.op("@@")(func.websearch_to_tsquery(ENGLISH, keywords))
            )
        if location:
            query = query.where(Job.location.ilike(_containing(location)))
        if employment_type:
            query = query.where(func.lower(Job.employment_type) == employment_type.lower())
        if cursor is not None:
            after = Cursor.decode(cursor)
            query = query.where(
                tuple_(Job.created_at, Job.id)
                < tuple_(literal(after.created_at), literal(after.id))
            )

        found = list((await self._db.execute(query)).tuples())
        rows, more = found[:limit], len(found) > limit
        return PublicJobPage(
            items=[_summary(job, tenant) for job, tenant in rows],
            next_cursor=Cursor(created_at=rows[-1][0].created_at, id=rows[-1][0].id).encode()
            if more
            else None,
        )

    async def job(self, job_id: UUID, visitor: Visitor) -> PublicJob:
        found = (await self._db.execute(_public_jobs().where(Job.id == job_id))).tuples().first()
        if found is None:
            raise Problem(
                status=404,
                type=JOB_NOT_FOUND_PROBLEM_TYPE,
                detail="No published job has that id.",
            )
        job, tenant = found
        await self._record_view(job.id, visitor, tracked_link_id=None)
        return await self._detail(job, tenant)

    async def by_link(self, token: str, visitor: Visitor) -> PublicJob:
        """A campaign landing. A link that has been turned off or has run out is simply gone."""
        link = await self._db.scalar(select(TrackedJobLink).where(TrackedJobLink.token == token))
        if link is None or not _usable(link):
            raise _dead_link()
        found = (
            (await self._db.execute(_public_jobs().where(Job.id == link.job_id))).tuples().first()
        )
        if found is None:
            raise _dead_link()
        job, tenant = found
        await self._record_view(job.id, visitor, tracked_link_id=link.id)
        return await self._detail(job, tenant)

    async def _record_view(
        self, job_id: UUID, visitor: Visitor, *, tracked_link_id: UUID | None
    ) -> None:
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

    async def _detail(self, job: Job, tenant: Tenant) -> PublicJob:
        return PublicJob(
            **_summary(job, tenant).model_dump(),
            description=job.description,
            minimum_total_experience_years=None
            if job.minimum_total_experience_years is None
            else float(job.minimum_total_experience_years),
            skills=await skills_of(self._db, job.id),
            languages=await languages_of(self._db, job.id),
            questions=await public_questions_of(self._db, job.id),
        )


def _public_jobs() -> Select[tuple[Job, Tenant]]:
    """Published, unexpired, and belonging to a tenant the platform has not suspended."""
    return (
        select(Job, Tenant)
        .join(Tenant, Tenant.id == Job.tenant_id)
        .where(
            Job.status == JobStatus.PUBLISHED,
            Tenant.is_active.is_(True),
            or_(Job.expires_at.is_(None), Job.expires_at > func.now()),
        )
    )


def _dead_link() -> Problem:
    return Problem(
        status=404,
        type=TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
        detail="This link is not one the platform will follow.",
    )


def _usable(link: TrackedJobLink) -> bool:
    return link.is_active and (link.expires_at is None or link.expires_at > datetime.now(UTC))


def _summary(job: Job, tenant: Tenant) -> PublicJobSummary:
    return PublicJobSummary(
        id=job.id,
        title=job.title,
        tenant=JobPublisher(name=tenant.name, slug=tenant.slug),
        location=job.location,
        employment_type=job.employment_type,
        expires_at=job.expires_at,
        created_at=job.created_at,
    )


def _containing(value: str) -> str:
    escaped = value.replace("\\", r"\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped}%"
