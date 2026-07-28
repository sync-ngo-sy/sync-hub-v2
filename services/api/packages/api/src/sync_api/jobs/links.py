from __future__ import annotations

from secrets import token_urlsafe
from typing import TYPE_CHECKING, Final, NoReturn

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from sync_api.integrity import refuse_duplicate
from sync_api.jobs.access import own_job
from sync_api.jobs.payload import TrackedLink
from sync_api.problems import (
    TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE,
    TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.models import JobViewEvent, TrackedJobLink

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.jobs.payload import NewTrackedLink, TrackedLinkChanges
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

TOKEN_BYTES: Final = 16

NAME_CONSTRAINT: Final = "tracked_job_links_tenant_id_job_id_name_key"


class TrackedLinkService:
    """The campaign links of one tenant's Jobs, and the traffic each has brought."""

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
        return _as_payload(link, views=0)

    async def links(self, recruiter: ActingRecruiter, job_id: UUID) -> list[TrackedLink]:
        await own_job(self._db, recruiter.tenant.id, job_id)
        rows = await self._db.execute(
            select(TrackedJobLink, func.count(JobViewEvent.id))
            .outerjoin(JobViewEvent, JobViewEvent.tracked_link_id == TrackedJobLink.id)
            .where(TrackedJobLink.job_id == job_id)
            .group_by(TrackedJobLink.id)
            .order_by(TrackedJobLink.created_at)
        )
        return [_as_payload(link, views=views) for link, views in rows.tuples()]

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
        return _as_payload(link, views=await self._views_of(link_id))

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

    async def _views_of(self, link_id: UUID) -> int:
        views = await self._db.scalar(
            select(func.count())
            .select_from(JobViewEvent)
            .where(JobViewEvent.tracked_link_id == link_id)
        )
        return int(views or 0)


def _refuse_duplicate_name(clash: IntegrityError, name: str) -> NoReturn:
    """A link's name is what a report calls it, so two of them in one Job is a clean 409."""
    refuse_duplicate(
        clash,
        NAME_CONSTRAINT,
        problem_type=TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE,
        detail=f"This job already has a link called “{name}”.",
    )


def _as_payload(link: TrackedJobLink, *, views: int) -> TrackedLink:
    return TrackedLink(
        id=link.id,
        name=link.name,
        token=link.token,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
        view_count=views,
    )
