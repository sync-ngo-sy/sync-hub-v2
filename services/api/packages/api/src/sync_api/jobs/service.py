from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING, Final

from sqlalchemy import Select, delete, exists, func, select
from sqlalchemy.exc import IntegrityError

from sync_api.jobs.access import WITH_LOCATION, location_name, lock_the_criteria, own_job
from sync_api.jobs.criteria import criteria_of
from sync_api.jobs.payload import JobPage, JobSort, JobStatusCount, JobSummary, JobView
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
    JOB_PLACE_REQUIRED_PROBLEM_TYPE,
    JOB_TRANSITION_PROBLEM_TYPE,
    JOB_WORK_MODE_REQUIRED_PROBLEM_TYPE,
    InvalidField,
    Problem,
)
from sync_api.text import LIKE_ESCAPE, containing
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
    WorkMode,
    t_placements,
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

#: Work modes that put people in a place, which is why such a Job has to name one.
TRAVELLED_TO: Final[frozenset[WorkMode]] = frozenset({WorkMode.ONSITE, WorkMode.HYBRID})

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
        _refuse_an_incomplete_job(
            work_mode=new.work_mode, location_key=new.location_key, status=JobStatus.DRAFT
        )
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
        q: str | None = None,
        status: JobStatus | None = None,
        work_mode: WorkMode | None = None,
        sort: JobSort = JobSort.NEWEST,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> JobPage:
        query = (
            select(Job, APPLICATION_COUNT, VIEW_COUNT)
            .options(*WITH_LOCATION)
            .where(Job.tenant_id == recruiter.tenant.id)
        )
        counting = (
            select(Job.status, func.count())
            .where(Job.tenant_id == recruiter.tenant.id)
            .group_by(Job.status)
        )
        written = (q or "").strip()
        if written:
            searched = Job.title.ilike(containing(written), escape=LIKE_ESCAPE)
            query = query.where(searched)
            counting = counting.where(searched)
        if work_mode is not None:
            query = query.where(Job.work_mode == work_mode)
            counting = counting.where(Job.work_mode == work_mode)
        if status is not None:
            query = query.where(Job.status == status)

        ordered, cursor_for = _ordering(query, sort, cursor, limit)
        found = list((await self._db.execute(ordered)).tuples())
        counted = dict((await self._db.execute(counting)).tuples().all())
        rows, next_cursor = page_of(found, limit=limit, cursor_for=cursor_for)
        return JobPage(
            items=[_summary(job, applications, views) for job, applications, views in rows],
            next_cursor=next_cursor,
            status_counts=[
                JobStatusCount(status=one, count=counted.get(one, 0)) for one in JobStatus
            ],
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
            _refuse_an_incomplete_job(
                work_mode=changed.get("work_mode", job.work_mode),
                location_key=changed.get("location_key", job.location_key),
                status=JobStatus(changed.get("status", job.status)),
            )
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

    async def _view(self, job: Job) -> JobView:
        applications, views, placements = (
            await self._db.execute(
                select(APPLICATION_COUNT, VIEW_COUNT, PLACEMENT_COUNT).where(Job.id == job.id)
            )
        ).one()
        return JobView(
            **_summary(job, applications, views).model_dump(),
            description=job.description,
            placement_count=placements,
            criteria=await criteria_of(self._db, job),
            criteria_locked=applications > 0,
        )


def _job_count(model: type[Application] | type[JobViewEvent]):
    return (
        select(func.count())
        .select_from(model)
        .where(model.job_id == Job.id)
        .correlate(Job)
        .scalar_subquery()
    )


#: Correlated so one page of Jobs carries its counts, rather than a request per row.
APPLICATION_COUNT: Final = _job_count(Application)

VIEW_COUNT: Final = _job_count(JobViewEvent)

#: Through the view rather than over `hire_claims`, so the number a Job carries and the one the
#: Placements page reads are the database's single definition of a Placement, counted twice.
PLACEMENT_COUNT: Final = (
    select(func.count())
    .select_from(t_placements)
    .join(Application, Application.id == t_placements.c.application_id)
    .where(Application.job_id == Job.id)
    .correlate(Job)
    .scalar_subquery()
)


type JobRow = tuple[Job, int, int]


@dataclass(frozen=True, slots=True)
class _JobPage:
    cursor: str | None
    limit: int
    order: str

    def newest(self, query: Select[JobRow]) -> Select[JobRow]:
        return newest_first(
            query,
            created_at=Job.created_at,
            id_=Job.id,
            cursor=self.cursor,
            limit=self.limit,
            cursor_order=self.order,
        )

    def oldest(self, query: Select[JobRow]) -> Select[JobRow]:
        return oldest_first(
            query,
            created_at=Job.created_at,
            id_=Job.id,
            cursor=self.cursor,
            limit=self.limit,
            cursor_order=self.order,
        )

    def most_applications(self, query: Select[JobRow]) -> Select[JobRow]:
        return most_first(
            query,
            rank=APPLICATION_COUNT,
            created_at=Job.created_at,
            id_=Job.id,
            cursor=self.cursor,
            limit=self.limit,
            cursor_order=self.order,
        )


def _ordering(
    query: Select[tuple[Job, int, int]], sort: JobSort, cursor: str | None, limit: int
) -> tuple[Select[tuple[Job, int, int]], Callable[[JobRow], Cursor]]:
    """One page in the order that was asked for.

    `applications` ranks on the same correlated count the rows carry, so the number a Recruiter
    sorted by and the number they read are one number, not two reads that could disagree.
    """
    page = _JobPage(cursor=cursor, limit=limit, order=sort.value)
    if sort is JobSort.OLDEST:
        return (
            page.oldest(query),
            lambda row: _cursor_for(row, sort, ranked=False),
        )
    if sort is JobSort.APPLICATIONS:
        return (
            page.most_applications(query),
            lambda row: _cursor_for(row, sort, ranked=True),
        )
    return (
        page.newest(query),
        lambda row: _cursor_for(row, sort, ranked=False),
    )


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


def _cursor_for(row: JobRow, sort: JobSort, *, ranked: bool) -> Cursor:
    job, applications, _views = row
    return Cursor(
        created_at=job.created_at,
        id=job.id,
        rank=applications if ranked else None,
        order=sort.value,
    )


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


def _refuse_an_incomplete_job(
    *, work_mode: WorkMode | None, location_key: str | None, status: JobStatus
) -> None:
    """The two CHECKs on `jobs`, restated over the row a write would leave behind.

    Restated rather than caught, because the constraint message a caller would otherwise read
    names an index. Both are read from the whole Job, never from the fields one request named:
    an edit that only says `onsite` is an edit that takes the Location away.
    """
    if work_mode in TRAVELLED_TO and location_key is None:
        raise Problem(
            status=422,
            type=JOB_PLACE_REQUIRED_PROBLEM_TYPE,
            detail="An onsite or hybrid Job names the place people go to.",
            errors=[
                InvalidField(
                    location="body.location_key",
                    message="Onsite and hybrid work happens somewhere. Name the Location, or "
                    "make the Job remote.",
                    type="place_required_for_work_mode",
                ).model_dump()
            ],
        )
    if status is JobStatus.PUBLISHED and work_mode is None:
        raise Problem(
            status=409,
            type=JOB_WORK_MODE_REQUIRED_PROBLEM_TYPE,
            detail="A published Job says how much of its work happens where the team is. "
            "Choose onsite, hybrid or remote first.",
        )


def _refuse_impossible_move(current: JobStatus, wanted: JobStatus) -> None:
    if wanted is current or wanted in LIFECYCLE[current]:
        return
    raise Problem(
        status=409,
        type=JOB_TRANSITION_PROBLEM_TYPE,
        detail=f"A {current.value} job cannot become {wanted.value}.",
    )
