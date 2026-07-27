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
from sync_api.candidates import languages_named, replace_live_profile, skills_named
from sync_api.jobs import PublicTenant
from sync_api.jobs.access import open_job
from sync_api.jobs.criteria import questions_of
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    CV_NOT_FOUND_PROBLEM_TYPE,
    CV_NOT_READY_PROBLEM_TYPE,
    DUPLICATE_APPLICATION_PROBLEM_TYPE,
    Problem,
)
from sync_api.vocabulary import canonical_skill_ids, refuse_unknown_languages
from sync_core import get_logger, transaction
from sync_core.communications import ApplicationConfirmation, enqueue_email
from sync_core.models import (
    Application as ApplicationRow,
)
from sync_core.models import (
    ApplicationQualificationHistory,
    ApplicationStatus,
    ApplicationStatusHistory,
    Cv,
    CvParsingStatus,
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
        await self._refuse_unready_cv(candidate.id, new.cv_id)
        refuse_unusable_answers(await questions_of(self._db, job.id), new.answers)
        skills = await canonical_skill_ids(self._db, skills_named(new.profile, "body.profile"))
        await refuse_unknown_languages(self._db, languages_named(new.profile, "body.profile"))
        criteria = await screening_criteria_of(self._db, job)
        await self._refuse_duplicate(candidate.id, job.id)

        application = ApplicationRow(
            id=uuid4(),
            tenant_id=job.tenant_id,
            candidate_id=candidate.id,
            job_id=job.id,
            cv_id=new.cv_id,
            tracked_link_id=await self._link_that_brought_them(job.id, visitor),
            status=ApplicationStatus.NEW,
        )
        snapshot = snapshot_rows(
            application.id,
            new.profile,
            skills,
            full_name=candidate.profile.full_name,
            phone=candidate.profile.phone,
        )
        answers = answer_rows(application.id, job.id, new.answers)
        verdict = screen(criteria, screened(snapshot, answers), today=datetime.now(UTC).date())
        try:
            async with transaction(self._db):
                self._db.add(application)
                await self._db.flush()
                self._db.add_all(snapshot.all())
                self._db.add_all(answers)
                self._db.add(
                    ApplicationStatusHistory(
                        application_id=application.id,
                        change_source=StatusChangeSource.CANDIDATE,
                        changed_by_profile_id=candidate.id,
                        previous_status=None,
                        new_status=ApplicationStatus.NEW,
                    )
                )
                application.qualification_status = verdict.status
                application.qualification_reason = verdict.reason
                self._db.add(
                    ApplicationQualificationHistory(
                        application_id=application.id,
                        qualification_status=verdict.status,
                        qualification_reason=verdict.reason,
                        screening_version=SCREENING_VERSION,
                    )
                )
                await enqueue_email(
                    self._db,
                    candidate_id=candidate.id,
                    tenant_id=job.tenant_id,
                    application_id=application.id,
                    recipient=candidate.profile.email,
                    idempotency_key=_confirmation_key(application.id),
                    payload=ApplicationConfirmation(
                        application_id=application.id,
                        job_title=job.title,
                        tenant_name=tenant.name,
                        candidate_name=candidate.profile.full_name,
                    ),
                )
                if new.update_profile:
                    await replace_live_profile(self._db, candidate.id, new.profile, skills)
        except IntegrityError as clash:
            # `applications_candidate_id_job_id_key` also refuses an application that landed
            # between the check above and this write.
            raise await self._duplicate_that_won(candidate.id, job.id) from clash

        logger.info(
            "applications.submitted",
            application_id=str(application.id),
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
            applied = await my_application(self._db, candidate.id, application_id)
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

    async def _refuse_unready_cv(self, candidate_id: UUID, cv_id: UUID) -> None:
        cv = await self._db.scalar(
            select(Cv).where(
                Cv.id == cv_id, Cv.candidate_id == candidate_id, Cv.deleted_at.is_(None)
            )
        )
        if cv is None:
            raise Problem(
                status=404,
                type=CV_NOT_FOUND_PROBLEM_TYPE,
                detail="No CV of yours has that id.",
            )
        if cv.parsing_status is not CvParsingStatus.READY:
            raise Problem(
                status=409,
                type=CV_NOT_READY_PROBLEM_TYPE,
                detail="This CV is still being processed. Wait for it to finish, or apply "
                "with another one.",
            )

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
            location=job.location,
            employment_type=job.employment_type,
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
