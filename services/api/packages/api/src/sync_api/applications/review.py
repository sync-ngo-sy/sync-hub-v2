from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from sync_api.applications.access import own_application
from sync_api.applications.ending import SweepScope, sweep_them_all
from sync_api.applications.hires import claim_the_hire, claimed_hire
from sync_api.applications.ordering import ORDERINGS
from sync_api.applications.payload import (
    RECEIVED_WITHIN_DAYS,
    ApplicationCv,
    ApplicationJob,
    ApplicationReview,
    ApplicationSort,
    ApplicationStatusCount,
    ApplicationSummary,
    ApplicationSummaryPage,
    ApplicationVerdictCount,
    MatchScore,
    MovedApplication,
    ReceivedWithin,
    ReviewedCandidate,
    ReviewedJob,
    ScreeningVerdict,
    StatusHistoryEntry,
    SweptApplications,
    TenantApplicationPage,
    TenantApplicationSummary,
)
from sync_api.applications.pipeline import move_application
from sync_api.applications.snapshot import answers_of, snapshot_of
from sync_api.cvs import signed_download
from sync_api.jobs.access import WITH_LOCATION, own_job
from sync_api.pagination import DEFAULT_PAGE_SIZE, cursor_for, ordered_by, page_of
from sync_api.windows import rolling_since
from sync_core import get_logger, transaction
from sync_core.models import (
    Application,
    ApplicationAiMatchAssessment,
    ApplicationProfileSnapshot,
    ApplicationStatus,
    ApplicationStatusHistory,
    Candidate,
    Cv,
    Job,
    Profile,
    QualificationStatus,
    StatusChangeSource,
    User,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence
    from typing import Any
    from uuid import UUID

    from sqlalchemy import Select
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.applications.payload import (
        ApplicationStatusChange,
        ApplicationSweep,
        TenantApplicationSweep,
    )
    from sync_api.pagination import Ordering, SortCursor
    from sync_api.tenants import ActingRecruiter
    from sync_core import Settings, Storage

logger = get_logger(__name__)


class ApplicationReviewService:
    """The recruiter's side of an Application: who applied, what they sent, and where it goes.

    Every read is scoped by tenant in the query itself, and every write goes through the
    pipeline, which is what keeps the status, its history and the candidate's bell in step.
    """

    def __init__(self, session: AsyncSession, storage: Storage, settings: Settings) -> None:
        self._db = session
        self._storage = storage
        self._settings = settings

    async def page(
        self,
        recruiter: ActingRecruiter,
        job_id: UUID,
        *,
        statuses: Sequence[ApplicationStatus] | None = None,
        qualification_statuses: Sequence[QualificationStatus] | None = None,
        sort: ApplicationSort = ApplicationSort.NEWEST,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> ApplicationSummaryPage:
        await own_job(self._db, recruiter.tenant.id, job_id)

        mine = (Application.job_id == job_id, Application.tenant_id == recruiter.tenant.id)
        query = _with_what_a_summary_shows(
            select(Application, ApplicationProfileSnapshot, ApplicationAiMatchAssessment)
        ).where(*mine)
        counting = (
            select(Application.status, func.count()).where(*mine).group_by(Application.status)
        )
        verdict_counting = (
            select(Application.qualification_status, func.count())
            .where(*mine)
            .group_by(Application.qualification_status)
        )
        if statuses is not None:
            query = query.where(Application.status.in_(statuses))
            verdict_counting = verdict_counting.where(Application.status.in_(statuses))
        if qualification_statuses is not None:
            query = query.where(Application.qualification_status.in_(qualification_statuses))
            counting = counting.where(Application.qualification_status.in_(qualification_statuses))

        sorting = ORDERINGS[sort]
        found = list(
            (
                await self._db.execute(
                    ordered_by(
                        query, ordering=sorting, id_=Application.id, cursor=cursor, limit=limit
                    )
                )
            ).tuples()
        )
        counted = dict((await self._db.execute(counting)).tuples().all())
        counted_verdicts = dict((await self._db.execute(verdict_counting)).tuples().all())
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_left_off_at(sorting))
        return ApplicationSummaryPage(
            items=[
                _summary(application, snapshot, assessment)
                for application, snapshot, assessment in rows
            ],
            next_cursor=next_cursor,
            status_counts=[
                ApplicationStatusCount(status=one, count=counted.get(one, 0))
                for one in ApplicationStatus
            ],
            verdict_counts=[
                ApplicationVerdictCount(verdict=one, count=counted_verdicts.get(one, 0))
                for one in QualificationStatus
            ],
        )

    async def tenant_page(
        self,
        recruiter: ActingRecruiter,
        *,
        statuses: Sequence[ApplicationStatus] | None = None,
        qualification_statuses: Sequence[QualificationStatus] | None = None,
        job_id: UUID | None = None,
        received_within: ReceivedWithin | None = None,
        sort: ApplicationSort = ApplicationSort.NEWEST,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> TenantApplicationPage:
        """Every Application the tenant has, whichever Job it came in for, in the order asked for.

        `job_id` narrows rather than fetches, so another tenant's Job is not a 404 here — it is
        a filter matching none of this tenant's Applications, which is what it truthfully is.

        Each set of counts is taken before its own filter narrows anything and after every other
        filter has, so either filter can hide something while still saying how much it is hiding,
        and each describes the list as the other leaves it.
        """
        mine = [Application.tenant_id == recruiter.tenant.id]
        if job_id is not None:
            mine.append(Application.job_id == job_id)
        if received_within is not None:
            mine.append(
                Application.applied_at > rolling_since(RECEIVED_WITHIN_DAYS[received_within])
            )

        query = (
            _with_what_a_summary_shows(
                select(Application, ApplicationProfileSnapshot, ApplicationAiMatchAssessment, Job)
            )
            .options(*WITH_LOCATION)
            .join(Job, Job.id == Application.job_id)
            .where(*mine)
        )
        counting = (
            select(Application.status, func.count()).where(*mine).group_by(Application.status)
        )
        verdict_counting = (
            select(Application.qualification_status, func.count())
            .where(*mine)
            .group_by(Application.qualification_status)
        )
        if statuses is not None:
            query = query.where(Application.status.in_(statuses))
            verdict_counting = verdict_counting.where(Application.status.in_(statuses))
        if qualification_statuses is not None:
            query = query.where(Application.qualification_status.in_(qualification_statuses))
            counting = counting.where(Application.qualification_status.in_(qualification_statuses))

        sorting = ORDERINGS[sort]
        found = list(
            (
                await self._db.execute(
                    ordered_by(
                        query, ordering=sorting, id_=Application.id, cursor=cursor, limit=limit
                    )
                )
            ).tuples()
        )
        counted = dict((await self._db.execute(counting)).tuples().all())
        counted_verdicts = dict((await self._db.execute(verdict_counting)).tuples().all())
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_left_off_at(sorting))
        return TenantApplicationPage(
            items=[
                TenantApplicationSummary(
                    **_summary(application, snapshot, assessment).model_dump(),
                    job=ApplicationJob.of(job),
                )
                for application, snapshot, assessment, job in rows
            ],
            next_cursor=next_cursor,
            status_counts=[
                ApplicationStatusCount(status=one, count=counted.get(one, 0))
                for one in ApplicationStatus
            ],
            verdict_counts=[
                ApplicationVerdictCount(verdict=one, count=counted_verdicts.get(one, 0))
                for one in QualificationStatus
            ],
        )

    async def review(self, recruiter: ActingRecruiter, application_id: UUID) -> ApplicationReview:
        applied = await own_application(self._db, recruiter.tenant.id, application_id)
        application = applied.application
        return ApplicationReview(
            id=application.id,
            job=ReviewedJob(id=applied.job.id, title=applied.job.title),
            candidate=await self._candidate(application.candidate_id),
            status=application.status,
            screening=ScreeningVerdict(
                status=application.qualification_status,
                reason=application.qualification_reason,
            ),
            snapshot=await snapshot_of(self._db, application.id),
            answers=await answers_of(self._db, application.id),
            history=await self._history(application.id),
            hire=await claimed_hire(self._db, application.id),
            cv=await self._cv(application.cv_id),
            told_at=application.told_at,
            applied_at=application.applied_at,
            updated_at=application.updated_at,
        )

    async def move(
        self, recruiter: ActingRecruiter, application_id: UUID, change: ApplicationStatusChange
    ) -> MovedApplication:
        async with transaction(self._db):
            applied = await own_application(
                self._db, recruiter.tenant.id, application_id, to_move=True
            )
            moved = await move_application(
                self._db,
                applied,
                to=change.status,
                source=StatusChangeSource.RECRUITER,
                by=recruiter.profile.id,
            )
            if change.status is ApplicationStatus.HIRED and change.start_date is not None:
                await claim_the_hire(
                    self._db,
                    application_id=application_id,
                    tenant_id=recruiter.tenant.id,
                    recruiter_id=recruiter.profile.id,
                    status_history_id=moved.status_history_id,
                    start_date=change.start_date,
                )

        logger.info(
            "applications.moved",
            application_id=str(application_id),
            tenant_id=str(recruiter.tenant.id),
            previous_status=moved.previous_status.value,
            status=moved.status.value,
            candidate_notified=moved.candidate_notified,
        )
        return MovedApplication(
            id=application_id,
            status=moved.status,
            previous_status=moved.previous_status,
            candidate_notified=moved.candidate_notified,
            told_at=moved.told_at,
            changed_at=moved.changed_at,
        )

    async def sweep(
        self, recruiter: ActingRecruiter, job_id: UUID, sweep: ApplicationSweep
    ) -> SweptApplications:
        """One Job's sweep. The Job is fetched rather than filtered on, so a Job this Tenant does
        not own is the 404 it really is rather than a sweep that quietly reaches nothing."""
        async with transaction(self._db):
            job = await own_job(self._db, recruiter.tenant.id, job_id)
            swept = await sweep_them_all(
                self._db,
                SweepScope(tenant_id=recruiter.tenant.id, job_id=job.id),
                statuses=sweep.statuses,
                to=sweep.to,
                qualification_statuses=sweep.qualification_statuses,
                by=recruiter.profile.id,
            )

        logger.info(
            "applications.swept",
            job_id=str(job_id),
            tenant_id=str(recruiter.tenant.id),
            statuses=sorted(status.value for status in sweep.statuses),
            to=sweep.to.value,
            swept=swept.count,
        )
        return SweptApplications(ended=swept.count, told_at=swept.told_at)

    async def sweep_tenant(
        self, recruiter: ActingRecruiter, sweep: TenantApplicationSweep
    ) -> SweptApplications:
        """The same act across every Job the Tenant is hiring for, carrying the Received window
        the Tenant-wide list adds to the Reading."""
        since = (
            rolling_since(RECEIVED_WITHIN_DAYS[sweep.received_within])
            if sweep.received_within is not None
            else None
        )
        async with transaction(self._db):
            swept = await sweep_them_all(
                self._db,
                SweepScope(tenant_id=recruiter.tenant.id, received_after=since),
                statuses=sweep.statuses,
                to=sweep.to,
                qualification_statuses=sweep.qualification_statuses,
                by=recruiter.profile.id,
            )

        logger.info(
            "applications.swept_tenant",
            tenant_id=str(recruiter.tenant.id),
            statuses=sorted(status.value for status in sweep.statuses),
            to=sweep.to.value,
            received_within=sweep.received_within.value if sweep.received_within else None,
            swept=swept.count,
        )
        return SweptApplications(ended=swept.count, told_at=swept.told_at)

    async def _candidate(self, candidate_id: UUID) -> ReviewedCandidate:
        found = (
            await self._db.execute(
                select(Profile.avatar_url, User.email)
                .join_from(Candidate, Profile, Profile.id == Candidate.id)
                .outerjoin(User, User.id == Candidate.id)
                .where(Candidate.id == candidate_id)
            )
        ).one()
        return ReviewedCandidate(id=candidate_id, email=found.email, avatar_url=found.avatar_url)

    async def _history(self, application_id: UUID) -> list[StatusHistoryEntry]:
        rows = await self._db.scalars(
            select(ApplicationStatusHistory)
            .where(ApplicationStatusHistory.application_id == application_id)
            .order_by(ApplicationStatusHistory.created_at, ApplicationStatusHistory.id)
        )
        return [
            StatusHistoryEntry(
                status=row.new_status,
                previous_status=row.previous_status,
                source=row.change_source,
                changed_at=row.created_at,
            )
            for row in rows
        ]

    async def _cv(self, cv_id: UUID) -> ApplicationCv:
        cv = await self._db.get(Cv, cv_id)
        if cv is None:  # pragma: no cover — the applications → cvs foreign key
            raise LookupError(f"no cv {cv_id}")
        link = await signed_download(self._storage, self._settings, cv)
        return ApplicationCv(
            id=cv.id,
            display_name=cv.display_name,
            download_url=link.url,
            expires_in_seconds=link.expires_in_seconds,
        )


def _left_off_at(ordering: Ordering) -> Callable[[Any], SortCursor]:
    """Where a row leaves the page off. Every list here selects the Application first, whatever
    else it selects beside it, so one reader serves them all."""
    return lambda row: cursor_for(ordering, row[0], id_=row[0].id)


def _with_what_a_summary_shows[Selected: tuple[Any, ...]](
    query: Select[Selected],
) -> Select[Selected]:
    """The Snapshot a row is named from, and the reading its score comes from.

    Outer, because an Application the worker has not reached yet is a row like any other, with
    nothing under its score.
    """
    return query.join(
        ApplicationProfileSnapshot,
        ApplicationProfileSnapshot.application_id == Application.id,
    ).outerjoin(
        ApplicationAiMatchAssessment,
        ApplicationAiMatchAssessment.application_id == Application.id,
    )


def _summary(
    application: Application,
    snapshot: ApplicationProfileSnapshot,
    assessment: ApplicationAiMatchAssessment | None,
) -> ApplicationSummary:
    return ApplicationSummary(
        id=application.id,
        candidate_name=snapshot.full_name,
        headline=snapshot.headline,
        location=snapshot.location,
        canonical_role=snapshot.canonical_role,
        total_experience_years=snapshot.total_experience_years,
        status=application.status,
        qualification_status=application.qualification_status,
        match=_match_score(assessment),
        applied_at=application.applied_at,
        updated_at=application.updated_at,
    )


def _match_score(assessment: ApplicationAiMatchAssessment | None) -> MatchScore | None:
    if assessment is None:
        return None
    return MatchScore(
        percentage=float(assessment.match_percentage),
        explanation=assessment.explanation,
        model_name=assessment.model_name,
        assessed_at=assessment.updated_at,
    )
