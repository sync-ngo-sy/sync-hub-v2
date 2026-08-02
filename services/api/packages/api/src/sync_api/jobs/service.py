from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Final

from sqlalchemy import delete, exists, select
from sqlalchemy.exc import IntegrityError

from sync_api.jobs.access import WITH_LOCATION, own_job
from sync_api.jobs.criteria import criteria_of
from sync_api.jobs.payload import JobPage, JobSummary, JobView
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    JOB_CRITERIA_LOCKED_PROBLEM_TYPE,
    JOB_TRANSITION_PROBLEM_TYPE,
    Problem,
)
from sync_api.vocabulary import (
    canonical_skill_ids,
    refuse_an_unknown_location,
    refuse_unknown_languages,
)
from sync_core import get_logger, transaction
from sync_core.models import (
    Application,
    Base,
    Job,
    JobApplicationQuestion,
    JobLanguage,
    JobSkill,
    JobStatus,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.jobs.payload import (
        JobChanges,
        JobCriteria,
        JobCriteriaView,
        NewJob,
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


class JobService:
    """The tenant's own view of its Jobs. Every read is scoped by tenant in the query itself."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def create(self, recruiter: ActingRecruiter, new: NewJob) -> JobView:
        await refuse_an_unknown_location(self._db, new.location_key, at="body.location_key")
        job = Job(
            tenant_id=recruiter.tenant.id,
            created_by_recruiter_id=recruiter.profile.id,
            title=new.title,
            description=new.description,
            location_key=new.location_key,
            employment_type=new.employment_type,
            expires_at=new.expires_at,
        )
        async with transaction(self._db):
            self._db.add(job)
        await self._db.refresh(job, ["location"])
        logger.info("jobs.created", tenant_id=str(recruiter.tenant.id), job_id=str(job.id))
        return await self._view(job)

    async def page(
        self,
        recruiter: ActingRecruiter,
        *,
        status: JobStatus | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> JobPage:
        query = select(Job).options(*WITH_LOCATION).where(Job.tenant_id == recruiter.tenant.id)
        if status is not None:
            query = query.where(Job.status == status)

        found = list(
            await self._db.scalars(
                newest_first(
                    query, created_at=Job.created_at, id_=Job.id, cursor=cursor, limit=limit
                )
            )
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return JobPage(items=[_summary(row) for row in rows], next_cursor=next_cursor)

    async def job(self, recruiter: ActingRecruiter, job_id: UUID) -> JobView:
        return await self._view(await own_job(self._db, recruiter.tenant.id, job_id))

    async def change(
        self, recruiter: ActingRecruiter, job_id: UUID, changes: JobChanges
    ) -> JobView:
        if "location_key" in changes.model_fields_set:
            await refuse_an_unknown_location(self._db, changes.location_key, at="body.location_key")
        async with transaction(self._db):
            job = await own_job(self._db, recruiter.tenant.id, job_id)
            changed = changes.model_dump(exclude_unset=True)
            if "status" in changed:
                _refuse_impossible_move(job.status, JobStatus(changed["status"]))
            for field, value in changed.items():
                setattr(job, field, value)
        logger.info("jobs.changed", job_id=str(job_id), fields=sorted(changed))
        # `updated_at` and `search_vector` are the triggers' to write, not ours.
        await self._db.refresh(job, ["updated_at", "location"])
        return await self._view(job)

    async def replace_criteria(
        self, recruiter: ActingRecruiter, job_id: UUID, criteria: JobCriteria
    ) -> JobCriteriaView:
        job = await own_job(self._db, recruiter.tenant.id, job_id)
        skills = await canonical_skill_ids(self._db, _skills_named(criteria))
        await refuse_unknown_languages(self._db, _languages_named(criteria))
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
        location_key=job.location_key,
        location_name=job.location.name if job.location else None,
        employment_type=job.employment_type,
        expires_at=job.expires_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _cursor(job: Job) -> Cursor:
    return Cursor(created_at=job.created_at, id=job.id)


def _skills_named(criteria: JobCriteria) -> dict[str, str]:
    return {
        f"body.skills.{position}.name": skill.name for position, skill in enumerate(criteria.skills)
    }


def _languages_named(criteria: JobCriteria) -> dict[str, str]:
    return {
        f"body.languages.{position}.code": language.code
        for position, language in enumerate(criteria.languages)
    }


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
