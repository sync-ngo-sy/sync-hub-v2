from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Final

from sqlalchemy import Select, delete, exists, func, select
from sqlalchemy.exc import IntegrityError

from sync_api.jobs.access import WITH_LOCATION, location_name, lock_the_criteria, own_job
from sync_api.jobs.criteria import criteria_of
from sync_api.jobs.payload import JobPage, JobSort, JobSummary, JobView
from sync_api.pagination import (
    DEFAULT_PAGE_SIZE,
    Cursor,
    most_first,
    newest_first,
    oldest_first,
    page_of,
)
from sync_api.problems import (
    JOB_CRITERIA_LOCKED_PROBLEM_TYPE,
    JOB_TRANSITION_PROBLEM_TYPE,
    Problem,
)
from sync_api.vocabulary import (
    canonical_skill_ids,
    refuse_unknown_languages,
    refuse_unknown_location,
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
    JobViewEvent,
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
        await refuse_unknown_location(self._db, new.location_key, at="body.location_key")
        job = Job(
            tenant_id=recruiter.tenant.id,
            created_by_recruiter_id=recruiter.profile.id,
            title=new.title,
            description=new.description,
            location_key=new.location_key,
            employment_type=new.employment_type,
            work_mode=new.work_mode,
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
        sort: JobSort = JobSort.NEWEST,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> JobPage:
        query = (
            select(Job, APPLICATION_COUNT, VIEW_COUNT)
            .options(*WITH_LOCATION)
            .where(Job.tenant_id == recruiter.tenant.id)
        )
        if status is not None:
            query = query.where(Job.status == status)

        found = list((await self._db.execute(_ordered(query, sort, cursor, limit))).tuples())
        rows, next_cursor = page_of(
            found, limit=limit, cursor_for=lambda row: _cursor(row[0], row[1], sort)
        )
        return JobPage(
            items=[_summary(job, applications, views) for job, applications, views in rows],
            next_cursor=next_cursor,
        )

    async def job(self, recruiter: ActingRecruiter, job_id: UUID) -> JobView:
        return await self._view(await own_job(self._db, recruiter.tenant.id, job_id))

    async def change(
        self, recruiter: ActingRecruiter, job_id: UUID, changes: JobChanges
    ) -> JobView:
        await refuse_unknown_location(self._db, changes.location_key, at="body.location_key")
        async with transaction(self._db):
            job = await own_job(self._db, recruiter.tenant.id, job_id, lock=True)
            changed = changes.model_dump(exclude_unset=True)
            if "status" in changed:
                _refuse_impossible_move(job.status, JobStatus(changed["status"]))
            was = job.status
            for field, value in changed.items():
                setattr(job, field, value)
            _stamp_publication(job, was=was)
        logger.info("jobs.changed", job_id=str(job_id), fields=sorted(changed))
        # `updated_at` and `search_vector` are the triggers' to write, not ours.
        await self._db.refresh(job, ["updated_at", "published_at", "location"])
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
                await lock_the_criteria(self._db, job)
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

    async def _applications(self, job_id: UUID) -> int:
        counted = await self._db.scalar(
            select(func.count()).select_from(Application).where(Application.job_id == job_id)
        )
        return counted or 0

    async def _views(self, job_id: UUID) -> int:
        counted = await self._db.scalar(
            select(func.count()).select_from(JobViewEvent).where(JobViewEvent.job_id == job_id)
        )
        return counted or 0

    async def _view(self, job: Job) -> JobView:
        # The count answers the lock too: criteria freeze on the first Application, so one read
        # settles both rather than asking the same table twice.
        applications = await self._applications(job.id)
        return JobView(
            **_summary(job, applications, await self._views(job.id)).model_dump(),
            description=job.description,
            criteria=await criteria_of(self._db, job),
            criteria_locked=applications > 0,
        )


#: Correlated so one page of Jobs carries its counts, rather than a request per row.
APPLICATION_COUNT: Final = (
    select(func.count())
    .select_from(Application)
    .where(Application.job_id == Job.id)
    .correlate(Job)
    .scalar_subquery()
)

#: Every view of the Job, whatever brought it. A Tracked link's own count is the links list's.
VIEW_COUNT: Final = (
    select(func.count())
    .select_from(JobViewEvent)
    .where(JobViewEvent.job_id == Job.id)
    .correlate(Job)
    .scalar_subquery()
)


def _ordered(
    query: Select[tuple[Job, int, int]], sort: JobSort, cursor: str | None, limit: int
) -> Select[tuple[Job, int, int]]:
    """One page in the order that was asked for.

    `applications` ranks on the same correlated count the rows carry, so the number a Recruiter
    sorted by and the number they read are one number, not two reads that could disagree.
    """
    if sort is JobSort.OLDEST:
        return oldest_first(
            query, created_at=Job.created_at, id_=Job.id, cursor=cursor, limit=limit
        )
    if sort is JobSort.APPLICATIONS:
        return most_first(
            query,
            rank=APPLICATION_COUNT,
            created_at=Job.created_at,
            id_=Job.id,
            cursor=cursor,
            limit=limit,
        )
    return newest_first(query, created_at=Job.created_at, id_=Job.id, cursor=cursor, limit=limit)


def _summary(job: Job, applications: int, views: int) -> JobSummary:
    return JobSummary(
        id=job.id,
        title=job.title,
        status=job.status,
        location_key=job.location_key,
        location_name=location_name(job),
        employment_type=job.employment_type,
        work_mode=job.work_mode,
        expires_at=job.expires_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        published_at=job.published_at,
        application_count=applications,
        view_count=views,
    )


def _stamp_publication(job: Job, *, was: JobStatus) -> None:
    """When the Job went live, written on the move that took it there and never rewritten.

    Both guards earn their place. The move matters because every Job published before this
    column existed carries a null: without it, the next edit to such a Job's title would stamp
    it as going live today and report a Job that has been open since March among this week's.
    The null check matters because a Job closed and republished went live when it first did.

    The database's clock, not this process's: the window that reads it (`published_last_week`)
    is `now() - interval` in SQL, so a second clock could put a Job just published outside the
    week it was published in.
    """
    became_live = job.status == JobStatus.PUBLISHED and was != JobStatus.PUBLISHED
    if became_live and job.published_at is None:
        job.published_at = func.now()


def _cursor(job: Job, applications: int, sort: JobSort) -> Cursor:
    rank = applications if sort is JobSort.APPLICATIONS else None
    return Cursor(created_at=job.created_at, id=job.id, rank=rank)


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
