from __future__ import annotations

from decimal import Decimal
from secrets import token_urlsafe
from typing import TYPE_CHECKING, Final

from sqlalchemy import delete, exists, func, literal, select, tuple_
from sqlalchemy.exc import IntegrityError

from sync_api.integrity import violated_constraint
from sync_api.jobs.criteria import criteria_of
from sync_api.jobs.payload import (
    JobPage,
    JobSummary,
    JobView,
    TrackedLink,
)
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor
from sync_api.problems import (
    JOB_CRITERIA_LOCKED_PROBLEM_TYPE,
    JOB_NOT_FOUND_PROBLEM_TYPE,
    JOB_TRANSITION_PROBLEM_TYPE,
    TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE,
    TRACKED_LINK_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_api.vocabulary import canonical_skill_ids, refuse_unknown_languages
from sync_core import get_logger, transaction
from sync_core.models import (
    Application,
    Base,
    Job,
    JobApplicationQuestion,
    JobLanguage,
    JobSkill,
    JobStatus,
    JobViewEvent,
    TrackedJobLink,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.jobs.payload import (
        JobChanges,
        JobCriteria,
        JobCriteriaView,
        NewJob,
        NewTrackedLink,
        TrackedLinkChanges,
    )
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

#: A Job is drafted, published, closed while it is decided, republished — and archived for good.
LIFECYCLE: Final[dict[JobStatus, frozenset[JobStatus]]] = {
    JobStatus.DRAFT: frozenset({JobStatus.PUBLISHED, JobStatus.ARCHIVED}),
    JobStatus.PUBLISHED: frozenset({JobStatus.CLOSED, JobStatus.ARCHIVED}),
    JobStatus.CLOSED: frozenset({JobStatus.PUBLISHED, JobStatus.ARCHIVED}),
    JobStatus.ARCHIVED: frozenset(),
}

TOKEN_BYTES: Final = 16

LINK_NAME_CONSTRAINT: Final = "tracked_job_links_tenant_id_job_id_name_key"


class JobService:
    """The tenant's own view of its Jobs. Every read is scoped by tenant in the query itself."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def create(self, recruiter: ActingRecruiter, new: NewJob) -> JobView:
        job = Job(
            tenant_id=recruiter.tenant.id,
            created_by_recruiter_id=recruiter.profile.id,
            title=new.title,
            description=new.description,
            location=new.location,
            employment_type=new.employment_type,
            expires_at=new.expires_at,
        )
        async with transaction(self._db):
            self._db.add(job)
        logger.info("jobs.created", tenant_id=str(recruiter.tenant.id), job_id=str(job.id))
        return await self._view(job)

    async def page(
        self,
        tenant_id: UUID,
        *,
        status: JobStatus | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> JobPage:
        query = (
            select(Job)
            .where(Job.tenant_id == tenant_id)
            .order_by(Job.created_at.desc(), Job.id.desc())
            .limit(limit + 1)
        )
        if status is not None:
            query = query.where(Job.status == status)
        if cursor is not None:
            after = Cursor.decode(cursor)
            query = query.where(
                tuple_(Job.created_at, Job.id)
                < tuple_(literal(after.created_at), literal(after.id))
            )

        found = list(await self._db.scalars(query))
        rows, more = found[:limit], len(found) > limit
        return JobPage(
            items=[_summary(row) for row in rows],
            next_cursor=Cursor(created_at=rows[-1].created_at, id=rows[-1].id).encode()
            if more
            else None,
        )

    async def job(self, tenant_id: UUID, job_id: UUID) -> JobView:
        return await self._view(await self._own_job(tenant_id, job_id))

    async def change(self, tenant_id: UUID, job_id: UUID, changes: JobChanges) -> JobView:
        async with transaction(self._db):
            job = await self._own_job(tenant_id, job_id)
            changed = changes.model_dump(exclude_unset=True)
            if "status" in changed:
                _refuse_impossible_move(job.status, JobStatus(changed["status"]))
            for field, value in changed.items():
                setattr(job, field, value)
        logger.info("jobs.changed", job_id=str(job_id), fields=sorted(changed))
        await self._db.refresh(job)  # `updated_at` is the trigger's to write, not ours
        return await self._view(job)

    async def replace_criteria(
        self, tenant_id: UUID, job_id: UUID, criteria: JobCriteria
    ) -> JobCriteriaView:
        skills = await canonical_skill_ids(
            self._db,
            {
                f"body.skills.{position}.name": skill.name
                for position, skill in enumerate(criteria.skills)
            },
        )
        await refuse_unknown_languages(
            self._db,
            {
                f"body.languages.{position}.code": language.code
                for position, language in enumerate(criteria.languages)
            },
        )

        job = await self._own_job(tenant_id, job_id)
        await self._refuse_if_locked(job_id)
        try:
            async with transaction(self._db):
                for section in (
                    delete(JobSkill).where(JobSkill.job_id == job_id),
                    delete(JobLanguage).where(JobLanguage.job_id == job_id),
                    delete(JobApplicationQuestion).where(JobApplicationQuestion.job_id == job_id),
                ):
                    await self._db.execute(section)
                job.minimum_total_experience_years = _as_decimal(
                    criteria.minimum_total_experience_years
                )
                self._db.add_all(_criteria_rows(job_id, criteria, skills))
        except IntegrityError:
            # The lock is a trigger, so it also fires for an Application that landed between
            # the check above and this write.
            await self._refuse_if_locked(job_id)
            raise

        logger.info("jobs.criteria_replaced", job_id=str(job_id))
        return await criteria_of(self._db, job)

    async def create_link(
        self, recruiter: ActingRecruiter, job_id: UUID, new: NewTrackedLink
    ) -> TrackedLink:
        await self._own_job(recruiter.tenant.id, job_id)
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
            if violated_constraint(clash) != LINK_NAME_CONSTRAINT:
                raise
            raise Problem(
                status=409,
                type=TRACKED_LINK_NAME_TAKEN_PROBLEM_TYPE,
                detail=f"This job already has a link called “{new.name}”.",
            ) from clash

        logger.info("jobs.link_created", job_id=str(job_id), link_id=str(link.id))
        return _link(link, views=0)

    async def links(self, tenant_id: UUID, job_id: UUID) -> list[TrackedLink]:
        await self._own_job(tenant_id, job_id)
        rows = await self._db.execute(
            select(TrackedJobLink, func.count(JobViewEvent.id))
            .outerjoin(JobViewEvent, JobViewEvent.tracked_link_id == TrackedJobLink.id)
            .where(TrackedJobLink.job_id == job_id)
            .group_by(TrackedJobLink.id)
            .order_by(TrackedJobLink.created_at)
        )
        return [_link(link, views=views) for link, views in rows.tuples()]

    async def change_link(
        self, tenant_id: UUID, job_id: UUID, link_id: UUID, changes: TrackedLinkChanges
    ) -> TrackedLink:
        async with transaction(self._db):
            link = await self._own_link(tenant_id, job_id, link_id)
            for field, value in changes.model_dump(exclude_unset=True).items():
                setattr(link, field, value)
        logger.info("jobs.link_changed", job_id=str(job_id), link_id=str(link_id))
        return _link(link, views=await self._views_of(link_id))

    async def _own_job(self, tenant_id: UUID, job_id: UUID) -> Job:
        job = await self._db.scalar(select(Job).where(Job.id == job_id, Job.tenant_id == tenant_id))
        if job is None:
            raise Problem(
                status=404,
                type=JOB_NOT_FOUND_PROBLEM_TYPE,
                detail="No job of this tenant has that id.",
            )
        return job

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

    async def _refuse_if_locked(self, job_id: UUID) -> None:
        if await self._has_applications(job_id):
            raise Problem(
                status=409,
                type=JOB_CRITERIA_LOCKED_PROBLEM_TYPE,
                detail="This job already has applications, so its criteria are fixed. "
                "The title, description and location can still be edited.",
            )

    async def _has_applications(self, job_id: UUID) -> bool:
        return bool(await self._db.scalar(select(exists().where(Application.job_id == job_id))))

    async def _views_of(self, link_id: UUID) -> int:
        views = await self._db.scalar(
            select(func.count())
            .select_from(JobViewEvent)
            .where(JobViewEvent.tracked_link_id == link_id)
        )
        return int(views or 0)

    async def _view(self, job: Job) -> JobView:
        return JobView(
            **_summary(job).model_dump(),
            description=job.description,
            criteria=await criteria_of(self._db, job),
            criteria_locked=await self._has_applications(job.id),
        )


def _summary(job: Job) -> JobSummary:
    return JobSummary(
        id=job.id,
        title=job.title,
        status=job.status,
        location=job.location,
        employment_type=job.employment_type,
        expires_at=job.expires_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _link(link: TrackedJobLink, *, views: int) -> TrackedLink:
    return TrackedLink(
        id=link.id,
        name=link.name,
        token=link.token,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
        view_count=views,
    )


def _criteria_rows(job_id: UUID, criteria: JobCriteria, skills: dict[str, UUID]) -> list[Base]:
    rows: list[Base] = [
        JobSkill(
            job_id=job_id,
            taxonomy_id=skills[skill.name],
            importance=skill.importance,
            minimum_years=skill.minimum_years,
        )
        for skill in criteria.skills
    ]
    rows += [
        JobLanguage(
            job_id=job_id,
            language_code=language.code,
            minimum_proficiency=language.minimum_proficiency,
        )
        for language in criteria.languages
    ]
    rows += [
        JobApplicationQuestion(
            job_id=job_id,
            sort_order=order,
            question_text=question.question_text,
            question_type=question.question_type,
            is_required=question.is_required,
            accepted_boolean_answer=question.accepted_boolean_answer,
        )
        for order, question in enumerate(criteria.questions)
    ]
    return rows


def _as_decimal(years: float | None) -> Decimal | None:
    """Through `str`, so `numeric(4,1)` stores the number that was typed, not its float."""
    return None if years is None else Decimal(str(years))


def _refuse_impossible_move(current: JobStatus, wanted: JobStatus) -> None:
    if wanted is current or wanted in LIFECYCLE[current]:
        return
    raise Problem(
        status=409,
        type=JOB_TRANSITION_PROBLEM_TYPE,
        detail=f"A {current.value} job cannot become {wanted.value}.",
    )
