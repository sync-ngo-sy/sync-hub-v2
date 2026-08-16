from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from sync_api.applications.access import own_application
from sync_api.applications.hires import claim_the_hire, claimed_hire
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
    MovedApplication,
    ReceivedWithin,
    ReviewedCandidate,
    ReviewedJob,
    ScreeningVerdict,
    StatusHistoryEntry,
    TenantApplicationPage,
    TenantApplicationSummary,
)
from sync_api.applications.pipeline import move_application
from sync_api.applications.snapshot import answers_of, snapshot_of
from sync_api.cvs import signed_download
from sync_api.jobs.access import WITH_LOCATION, location_name, own_job
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, oldest_first, page_of
from sync_api.windows import rolling_since
from sync_core import get_logger, transaction
from sync_core.communications import ApplicationRejection, candidate_contact, enqueue_email
from sync_core.models import (
    Application,
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
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.applications.access import Applied
    from sync_api.applications.payload import ApplicationStatusChange
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
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> ApplicationSummaryPage:
        await own_job(self._db, recruiter.tenant.id, job_id)

        mine = (Application.job_id == job_id, Application.tenant_id == recruiter.tenant.id)
        query = (
            select(Application, ApplicationProfileSnapshot)
            .join(
                ApplicationProfileSnapshot,
                ApplicationProfileSnapshot.application_id == Application.id,
            )
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

        found = list(
            (
                await self._db.execute(
                    newest_first(
                        query,
                        created_at=Application.applied_at,
                        id_=Application.id,
                        cursor=cursor,
                        limit=limit,
                    )
                )
            ).tuples()
        )
        counted = dict((await self._db.execute(counting)).tuples().all())
        counted_verdicts = dict((await self._db.execute(verdict_counting)).tuples().all())
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return ApplicationSummaryPage(
            items=[_summary(application, snapshot) for application, snapshot in rows],
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
            select(Application, ApplicationProfileSnapshot, Job)
            .options(*WITH_LOCATION)
            .join(
                ApplicationProfileSnapshot,
                ApplicationProfileSnapshot.application_id == Application.id,
            )
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

        ordering = oldest_first if sort is ApplicationSort.OLDEST else newest_first
        found = list(
            (
                await self._db.execute(
                    ordering(
                        query,
                        created_at=Application.applied_at,
                        id_=Application.id,
                        cursor=cursor,
                        limit=limit,
                        cursor_order=sort.value,
                    )
                )
            ).tuples()
        )
        counted = dict((await self._db.execute(counting)).tuples().all())
        counted_verdicts = dict((await self._db.execute(verdict_counting)).tuples().all())
        rows, next_cursor = page_of(
            found, limit=limit, cursor_for=lambda row: _tenant_cursor(row, sort)
        )
        return TenantApplicationPage(
            items=[
                TenantApplicationSummary(
                    **_summary(application, snapshot).model_dump(),
                    job=ApplicationJob(
                        id=job.id, title=job.title, location_name=location_name(job)
                    ),
                )
                for application, snapshot, job in rows
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
            if change.status is ApplicationStatus.REJECTED:
                await self._queue_the_rejection(recruiter, applied, moved.status_history_id)
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
            changed_at=moved.changed_at,
        )

    async def _queue_the_rejection(
        self, recruiter: ActingRecruiter, applied: Applied, status_history_id: UUID
    ) -> None:
        """The one rejection that emails: keyed by the move, so undoing and deciding it again
        is a second decision the Candidate hears about, not a swallowed duplicate."""
        application = applied.application
        full_name, email = await candidate_contact(self._db, application.candidate_id)
        await enqueue_email(
            self._db,
            candidate_id=application.candidate_id,
            tenant_id=application.tenant_id,
            application_id=application.id,
            initiated_by_recruiter_id=recruiter.profile.id,
            recipient=email,
            idempotency_key=f"application-rejection:{status_history_id}",
            payload=ApplicationRejection(
                application_id=application.id,
                job_title=applied.job.title,
                tenant_name=applied.tenant_name,
                candidate_name=full_name,
            ),
        )

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


def _summary(application: Application, snapshot: ApplicationProfileSnapshot) -> ApplicationSummary:
    return ApplicationSummary(
        id=application.id,
        candidate_name=snapshot.full_name,
        headline=snapshot.headline,
        location=snapshot.location,
        canonical_role=snapshot.canonical_role,
        total_experience_years=snapshot.total_experience_years,
        status=application.status,
        qualification_status=application.qualification_status,
        applied_at=application.applied_at,
        updated_at=application.updated_at,
    )


def _cursor(row: tuple[Application, ApplicationProfileSnapshot]) -> Cursor:
    application, _snapshot = row
    return Cursor(created_at=application.applied_at, id=application.id)


def _tenant_cursor(
    row: tuple[Application, ApplicationProfileSnapshot, Job], sort: ApplicationSort
) -> Cursor:
    application, _snapshot, _job = row
    return Cursor(created_at=application.applied_at, id=application.id, order=sort.value)
