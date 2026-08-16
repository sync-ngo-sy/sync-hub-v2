from __future__ import annotations

from secrets import token_urlsafe
from typing import TYPE_CHECKING, Final, NoReturn

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from sync_api.integrity import refuse_duplicate
from sync_api.jobs.access import own_job
from sync_api.jobs.payload import (
    LinkedJob,
    TenantTrackedLink,
    TenantTrackedLinkPage,
    TrackedLink,
    TrackedLinkReport,
)
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE,
    TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_api.rates import percentage
from sync_api.text import LIKE_ESCAPE, containing
from sync_core import get_logger, transaction
from sync_core.models import Application, Job, JobViewEvent, TrackedJobLink

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.jobs.payload import NewTrackedLink, TrackedLinkChanges
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

TOKEN_BYTES: Final = 16

NAME_CONSTRAINT: Final = "tracked_job_links_tenant_id_job_id_name_key"


class TrackedLinkService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def create(
        self, recruiter: ActingRecruiter, job_id: UUID, new: NewTrackedLink
    ) -> TrackedLink:
        await own_job(self._db, recruiter.tenant.id, job_id)
        link = TrackedJobLink(
            tenant_id=recruiter.tenant.id,
            job_id=job_id,
            created_by_recruiter_id=recruiter.profile.id,
            name=new.name,
            token=token_urlsafe(TOKEN_BYTES),
            expires_at=new.expires_at,
        )
        try:
            async with transaction(self._db):
                self._db.add(link)
        except IntegrityError as clash:
            _refuse_duplicate_name(clash, new.name)

        logger.info("jobs.link_created", job_id=str(job_id), link_id=str(link.id))
        return _as_payload(link, views=0, applications=0)

    async def links(self, recruiter: ActingRecruiter, job_id: UUID) -> TrackedLinkReport:
        await own_job(self._db, recruiter.tenant.id, job_id)
        direct_count = (
            select(func.count())
            .select_from(JobViewEvent)
            .where(JobViewEvent.job_id == job_id, JobViewEvent.tracked_link_id.is_(None))
            .scalar_subquery()
        )
        total_count = (
            select(func.count())
            .select_from(JobViewEvent)
            .where(JobViewEvent.job_id == job_id)
            .scalar_subquery()
        )
        rows = list(
            (
                await self._db.execute(
                    select(TrackedJobLink, VIEW_COUNT, APPLICATION_COUNT, direct_count, total_count)
                    .select_from(Job)
                    .outerjoin(TrackedJobLink, TrackedJobLink.job_id == Job.id)
                    .where(Job.id == job_id)
                    .order_by(TrackedJobLink.created_at)
                )
            ).tuples()
        )
        first = rows[0]
        return TrackedLinkReport(
            items=[
                _as_payload(link, views=link_views, applications=link_applications)
                for link, link_views, link_applications, _direct, _total in rows
                if link is not None
            ],
            direct_view_count=first[3],
            view_count=first[4],
        )

    async def change(
        self,
        recruiter: ActingRecruiter,
        job_id: UUID,
        link_id: UUID,
        changes: TrackedLinkChanges,
    ) -> TrackedLink:
        link = await self._own_link(recruiter.tenant.id, job_id, link_id)
        try:
            async with transaction(self._db):
                for field, value in changes.model_dump(exclude_unset=True).items():
                    setattr(link, field, value)
        except IntegrityError as clash:
            _refuse_duplicate_name(clash, changes.name or link.name)

        logger.info("jobs.link_changed", job_id=str(job_id), link_id=str(link_id))
        views, applications = await self._counts_of(link_id)
        return _as_payload(link, views=views, applications=applications)

    async def _own_link(self, tenant_id: UUID, job_id: UUID, link_id: UUID) -> TrackedJobLink:
        link = await self._db.scalar(
            select(TrackedJobLink).where(
                TrackedJobLink.id == link_id,
                TrackedJobLink.job_id == job_id,
                TrackedJobLink.tenant_id == tenant_id,
            )
        )
        if link is None:
            raise Problem(
                status=404,
                type=TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
                detail="No link of this job has that id.",
            )
        return link

    async def tenant_page(
        self,
        recruiter: ActingRecruiter,
        *,
        q: str | None = None,
        is_active: bool | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> TenantTrackedLinkPage:
        """Every Tracked link the tenant has, across every Job, newest first.

        Expiry is not a filter here. A link expires by a date the caller already has, so
        deciding "live" from "expired" costs the reader nothing and costs this query a clock.
        """
        query = (
            select(TrackedJobLink, Job, VIEW_COUNT, APPLICATION_COUNT)
            .join(Job, Job.id == TrackedJobLink.job_id)
            .where(TrackedJobLink.tenant_id == recruiter.tenant.id)
        )
        if q is not None:
            query = query.where(TrackedJobLink.name.ilike(containing(q), escape=LIKE_ESCAPE))
        if is_active is not None:
            query = query.where(TrackedJobLink.is_active.is_(is_active))

        found = list(
            (
                await self._db.execute(
                    newest_first(
                        query,
                        created_at=TrackedJobLink.created_at,
                        id_=TrackedJobLink.id,
                        cursor=cursor,
                        limit=limit,
                    )
                )
            ).tuples()
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return TenantTrackedLinkPage(
            items=[
                TenantTrackedLink(
                    **_as_payload(link, views=views, applications=applications).model_dump(),
                    job=LinkedJob(id=job.id, title=job.title),
                )
                for link, job, views, applications in rows
            ],
            next_cursor=next_cursor,
        )

    async def _counts_of(self, link_id: UUID) -> tuple[int, int]:
        views, applications = (
            await self._db.execute(
                select(VIEW_COUNT, APPLICATION_COUNT).where(TrackedJobLink.id == link_id)
            )
        ).one()
        return int(views), int(applications)


#: Correlated so one page of links carries its counts, rather than a request per row.
VIEW_COUNT: Final = (
    select(func.count())
    .select_from(JobViewEvent)
    .where(JobViewEvent.tracked_link_id == TrackedJobLink.id)
    .correlate(TrackedJobLink)
    .scalar_subquery()
)

#: Matched on the Job as well as the link, which is what the composite index is ordered by. A
#: link belongs to one Job, so the Job adds nothing to the answer and everything to the plan.
APPLICATION_COUNT: Final = (
    select(func.count())
    .select_from(Application)
    .where(
        Application.job_id == TrackedJobLink.job_id,
        Application.tracked_link_id == TrackedJobLink.id,
    )
    .correlate(TrackedJobLink)
    .scalar_subquery()
)


def _cursor(row: tuple[TrackedJobLink, Job, int, int]) -> Cursor:
    link, _job, _views, _applications = row
    return Cursor(created_at=link.created_at, id=link.id)


def _refuse_duplicate_name(clash: IntegrityError, name: str) -> NoReturn:
    """A link's name is what a report calls it, so two of them in one Job is a clean 409."""
    refuse_duplicate(
        clash,
        NAME_CONSTRAINT,
        problem_type=TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE,
        detail=f"This job already has a link called “{name}”.",
    )


def _as_payload(link: TrackedJobLink, *, views: int, applications: int) -> TrackedLink:
    return TrackedLink(
        id=link.id,
        name=link.name,
        token=link.token,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
        view_count=views,
        application_count=applications,
        conversion_rate=percentage(applications, of=views),
    )
