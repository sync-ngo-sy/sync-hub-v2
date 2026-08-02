from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from sync_api.applications.access import my_application
from sync_api.applications.answers import answer_rows, refuse_unusable_answers
from sync_api.applications.criteria import screening_criteria_of
from sync_api.applications.payload import (
    Application,
    ApplicationPage,
    AppliedJob,
    MovedApplication,
)
from sync_api.applications.pipeline import move_application
from sync_api.applications.screening import SCREENING_VERSION, screen
from sync_api.applications.snapshot import screened, snapshot_rows
from sync_api.candidates import refuse_incomplete_profile, whole_candidate
from sync_api.jobs import PublicTenant
from sync_api.jobs.access import WITH_LOCATION, location_name, open_job
from sync_api.jobs.criteria import questions_of
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    DUPLICATE_APPLICATION_PROBLEM_TYPE,
    NO_CURRENT_CV_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.communications import ApplicationConfirmation, enqueue_email
from sync_core.models import (
    Application as ApplicationRow,
)
from sync_core.models import (
    ApplicationQualificationHistory,
    ApplicationStatus,
    ApplicationStatusHistory,
    Candidate,
    Job,
    JobViewEvent,
    StatusChangeSource,
    Tenant,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.applications.payload import NewApplication
    from sync_api.candidates import ActingCandidate
    from sync_api.jobs import Visitor

logger = get_logger(__name__)


class ApplicationService:
    """Applying, and the caller's own record of having applied."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def submit(
        self, candidate: ActingCandidate, visitor: Visitor, new: NewApplication
    ) -> Application:
        """The core transaction: an Application is never observable without its verdict."""
        job, tenant = await open_job(self._db, new.job_id)
        refuse_unusable_answers(await questions_of(self._db, job.id), new.answers)
        criteria = await screening_criteria_of(self._db, job)
        await self._refuse_duplicate(candidate.id, job.id)

        application_id = uuid4()
        answers = answer_rows(application_id, job.id, new.answers)
        try:
            async with transaction(self._db):
                # Under the candidate row's lock, and so inside the transaction: every writer of
                # a profile queues on that row, and a save landing between these checks and the
                # copy below would otherwise Snapshot a profile nobody ever judged as complete.
                held, _identity = await whole_candidate(self._db, candidate.id, lock=True)
                cv_id = self._held_cv(held)
                await refuse_incomplete_profile(self._db, candidate.id)

                application = ApplicationRow(
                    id=application_id,
                    tenant_id=job.tenant_id,
                    candidate_id=candidate.id,
                    job_id=job.id,
                    cv_id=cv_id,
                    tracked_link_id=await self._link_that_brought_them(job.id, visitor),
                    status=ApplicationStatus.NEW,
                )
                self._db.add(application)
                await self._db.flush()
                for statement in snapshot_rows(application_id, candidate.id):
                    await self._db.execute(statement)
                self._db.add_all(answers)
                self._db.add(
                    ApplicationStatusHistory(
                        application_id=application_id,
                        change_source=StatusChangeSource.CANDIDATE,
                        changed_by_profile_id=candidate.id,
                        previous_status=None,
                        new_status=ApplicationStatus.NEW,
                    )
                )
                verdict = screen(
                    criteria,
                    await screened(self._db, application_id, answers),
                    today=datetime.now(UTC).date(),
                )
                application.qualification_status = verdict.status
                application.qualification_reason = verdict.reason
                self._db.add(
                    ApplicationQualificationHistory(
                        application_id=application_id,
                        qualification_status=verdict.status,
                        qualification_reason=verdict.reason,
                        screening_version=SCREENING_VERSION,
                    )
                )
                await enqueue_email(
                    self._db,
                    candidate_id=candidate.id,
                    tenant_id=job.tenant_id,
                    application_id=application_id,
                    recipient=candidate.profile.email,
                    idempotency_key=_confirmation_key(application_id),
                    payload=ApplicationConfirmation(
                        application_id=application_id,
                        job_title=job.title,
                        tenant_name=tenant.name,
                        candidate_name=candidate.profile.full_name,
                    ),
                )
        except IntegrityError as clash:
            # `applications_candidate_id_job_id_key` also refuses an application that landed
            # between the check above and this write.
            raise await self._duplicate_that_won(candidate.id, job.id) from clash

        logger.info(
            "applications.submitted",
            application_id=str(application_id),
            job_id=str(job.id),
            qualification_status=verdict.status.value,
            tracked_link_id=None
            if application.tracked_link_id is None
            else str(application.tracked_link_id),
        )
        await self._db.refresh(application)
        return _as_payload(application, job, tenant)

    async def withdraw(self, candidate: ActingCandidate, application_id: UUID) -> MovedApplication:
        """Leave the process, for good: the Job stays taken, so re-applying is not a thing."""
        async with transaction(self._db):
            applied = await my_application(self._db, candidate.id, application_id, to_move=True)
            moved = await move_application(
                self._db,
                applied,
                to=ApplicationStatus.WITHDRAWN,
                source=StatusChangeSource.CANDIDATE,
                by=candidate.id,
            )

        logger.info(
            "applications.withdrawn",
            application_id=str(application_id),
            previous_status=moved.previous_status.value,
        )
        return MovedApplication(
            id=application_id,
            status=moved.status,
            previous_status=moved.previous_status,
            changed_at=moved.changed_at,
        )

    async def page(
        self,
        candidate: ActingCandidate,
        *,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> ApplicationPage:
        found = list(
            (
                await self._db.execute(
                    newest_first(
                        select(ApplicationRow, Job, Tenant)
                        .options(*WITH_LOCATION)
                        .join(Job, Job.id == ApplicationRow.job_id)
                        .join(Tenant, Tenant.id == ApplicationRow.tenant_id)
                        .where(ApplicationRow.candidate_id == candidate.id),
                        created_at=ApplicationRow.applied_at,
                        id_=ApplicationRow.id,
                        cursor=cursor,
                        limit=limit,
                    )
                )
            ).tuples()
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return ApplicationPage(items=[_as_payload(*row) for row in rows], next_cursor=next_cursor)

    def _held_cv(self, candidate: Candidate) -> UUID:
        """The CV the candidate holds — the only one they can apply with.

        Whether it exists and is not deleted is the database's answer already
        (`forbid_deleting_current_cv`, `forbid_deleted_current_cv`), so all that is left to
        check is that the pointer is set at all.
        """
        if candidate.current_cv_id is None:
            raise Problem(
                status=409,
                type=NO_CURRENT_CV_PROBLEM_TYPE,
                detail="You have no CV yet. Upload one in your profile settings, then apply.",
            )
        return candidate.current_cv_id

    async def _refuse_duplicate(self, candidate_id: UUID, job_id: UUID) -> None:
        existing = await self._existing(candidate_id, job_id)
        if existing is not None:
            raise _duplicate(existing)

    async def _duplicate_that_won(self, candidate_id: UUID, job_id: UUID) -> Problem:
        winner = await self._existing(candidate_id, job_id)
        if winner is None:  # pragma: no cover — some other constraint, which is our bug
            return Problem(status=500, detail="The application could not be saved.")
        return _duplicate(winner)

    async def _existing(self, candidate_id: UUID, job_id: UUID) -> UUID | None:
        existing: UUID | None = await self._db.scalar(
            select(ApplicationRow.id).where(
                ApplicationRow.candidate_id == candidate_id, ApplicationRow.job_id == job_id
            )
        )
        return existing

    async def _link_that_brought_them(self, job_id: UUID, visitor: Visitor) -> UUID | None:
        """The campaign link this browser last read the Job through, if it read it through one.

        Attribution is the visitor cookie's, not the applicant's: a Candidate who landed on a
        tracked link keeps carrying it through signup and into the submission, and one who
        found the Job themselves carries nothing.
        """
        found: UUID | None = await self._db.scalar(
            select(JobViewEvent.tracked_link_id)
            .where(
                JobViewEvent.job_id == job_id,
                JobViewEvent.session_id == visitor.session_id,
                JobViewEvent.tracked_link_id.is_not(None),
            )
            .order_by(JobViewEvent.viewed_at.desc(), JobViewEvent.id.desc())
            .limit(1)
        )
        return found


def _as_payload(application: ApplicationRow, job: Job, tenant: Tenant) -> Application:
    return Application(
        id=application.id,
        job=AppliedJob(
            id=job.id,
            title=job.title,
            tenant=PublicTenant(name=tenant.name, slug=tenant.slug),
            location_key=job.location_key,
            location_name=location_name(job),
            employment_type=job.employment_type,
            work_mode=job.work_mode,
        ),
        cv_id=application.cv_id,
        status=application.status,
        applied_at=application.applied_at,
        updated_at=application.updated_at,
    )


def _cursor(row: tuple[ApplicationRow, Job, Tenant]) -> Cursor:
    application, _job, _tenant = row
    return Cursor(created_at=application.applied_at, id=application.id)


def _confirmation_key(application_id: UUID) -> str:
    """One confirmation per Application, whatever the sender retries."""
    return f"application-confirmation:{application_id}"


def _duplicate(existing: UUID) -> Problem:
    return Problem(
        status=409,
        type=DUPLICATE_APPLICATION_PROBLEM_TYPE,
        detail="You have already applied to this job.",
        application_id=str(existing),
    )
