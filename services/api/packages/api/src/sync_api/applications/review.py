from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.applications.access import own_application
from sync_api.applications.payload import (
    AnsweredQuestion,
    ApplicantPage,
    ApplicantSummary,
    ApplicationCv,
    ApplicationReview,
    ApplicationSnapshot,
    MovedApplication,
    ReviewedJob,
    ScreeningVerdict,
    StatusChange,
)
from sync_api.applications.pipeline import move_application
from sync_api.candidates import (
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.cvs import signed_download
from sync_api.jobs.access import own_job
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_core import get_logger, transaction
from sync_core.communications import ApplicationRejection, enqueue_email
from sync_core.models import (
    Application,
    ApplicationAnswer,
    ApplicationEducation,
    ApplicationExperience,
    ApplicationLanguage,
    ApplicationProfileSnapshot,
    ApplicationProject,
    ApplicationSkill,
    ApplicationStatus,
    ApplicationStatusHistory,
    Cv,
    JobApplicationQuestion,
    Profile,
    QualificationStatus,
    SkillTaxonomy,
    StatusChangeSource,
    User,
)

if TYPE_CHECKING:
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

    async def applicants(
        self,
        recruiter: ActingRecruiter,
        job_id: UUID,
        *,
        status: ApplicationStatus | None = None,
        qualification_status: QualificationStatus | None = None,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> ApplicantPage:
        await own_job(self._db, recruiter.tenant.id, job_id)

        query = (
            select(Application, ApplicationProfileSnapshot)
            .join(
                ApplicationProfileSnapshot,
                ApplicationProfileSnapshot.application_id == Application.id,
            )
            .where(Application.job_id == job_id, Application.tenant_id == recruiter.tenant.id)
        )
        if status is not None:
            query = query.where(Application.status == status)
        if qualification_status is not None:
            query = query.where(Application.qualification_status == qualification_status)

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
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return ApplicantPage(
            items=[_summary(application, snapshot) for application, snapshot in rows],
            next_cursor=next_cursor,
        )

    async def review(self, recruiter: ActingRecruiter, application_id: UUID) -> ApplicationReview:
        applied = await own_application(self._db, recruiter.tenant.id, application_id)
        application = applied.application
        return ApplicationReview(
            id=application.id,
            job=ReviewedJob(id=applied.job.id, title=applied.job.title),
            status=application.status,
            screening=ScreeningVerdict(
                status=application.qualification_status,
                reason=application.qualification_reason,
            ),
            snapshot=await self._snapshot(application.id),
            answers=await self._answers(application.id),
            history=await self._history(application.id),
            cv=await self._cv(application.cv_id),
            applied_at=application.applied_at,
            updated_at=application.updated_at,
        )

    async def move(
        self, recruiter: ActingRecruiter, application_id: UUID, change: ApplicationStatusChange
    ) -> MovedApplication:
        async with transaction(self._db):
            applied = await own_application(self._db, recruiter.tenant.id, application_id)
            moved = await move_application(
                self._db,
                applied,
                to=change.status,
                source=StatusChangeSource.RECRUITER,
                by=recruiter.profile.id,
            )
            if change.status is ApplicationStatus.REJECTED:
                await self._queue_the_rejection(recruiter, applied, moved.id)

        logger.info(
            "applications.moved",
            application_id=str(application_id),
            tenant_id=str(recruiter.tenant.id),
            previous_status=moved.previous_status.value,
            status=moved.status.value,
        )
        return MovedApplication(
            id=application_id,
            status=moved.status,
            previous_status=moved.previous_status,
            changed_at=moved.changed_at,
        )

    async def _queue_the_rejection(
        self, recruiter: ActingRecruiter, applied: Applied, move_id: UUID
    ) -> None:
        """The one rejection that emails: keyed by the move, so undoing and deciding it again
        is a second decision the Candidate hears about, not a swallowed duplicate."""
        application = applied.application
        full_name, email = await self._candidate_contact(application.candidate_id)
        await enqueue_email(
            self._db,
            candidate_id=application.candidate_id,
            tenant_id=application.tenant_id,
            application_id=application.id,
            initiated_by_recruiter_id=recruiter.profile.id,
            recipient=email,
            idempotency_key=f"application-rejection:{move_id}",
            payload=ApplicationRejection(
                application_id=application.id,
                job_title=applied.job.title,
                tenant_name=applied.tenant_name,
                candidate_name=full_name,
            ),
        )

    async def _candidate_contact(self, candidate_id: UUID) -> tuple[str, str]:
        """The name to greet and the address as it stands now; the sender resolves the verified
        one again before it delivers."""
        full_name, email = (
            (
                await self._db.execute(
                    select(Profile.full_name, User.email)
                    .join(User, User.id == Profile.id)
                    .where(Profile.id == candidate_id)
                )
            )
            .tuples()
            .one()
        )
        return full_name, email or ""

    async def _snapshot(self, application_id: UUID) -> ApplicationSnapshot:
        captured = await self._db.get(ApplicationProfileSnapshot, application_id)
        if captured is None:  # pragma: no cover — written in the submission transaction
            raise LookupError(f"no snapshot for application {application_id}")
        return ApplicationSnapshot(
            full_name=captured.full_name,
            phone=captured.phone,
            headline=captured.headline,
            summary=captured.summary,
            location=captured.location,
            experiences=await self._experiences(application_id),
            educations=await self._educations(application_id),
            skills=await self._skills(application_id),
            languages=await self._languages(application_id),
            projects=await self._projects(application_id),
        )

    async def _experiences(self, application_id: UUID) -> list[ProfileExperience]:
        rows = await self._db.scalars(
            select(ApplicationExperience)
            .where(ApplicationExperience.application_id == application_id)
            .order_by(ApplicationExperience.sort_order)
        )
        return [
            ProfileExperience(
                job_title=row.job_title,
                company_name=row.company_name,
                start_year=row.start_year,
                start_month=row.start_month,
                end_year=row.end_year,
                end_month=row.end_month,
                is_current=row.is_current,
                description=row.description,
            )
            for row in rows
        ]

    async def _educations(self, application_id: UUID) -> list[ProfileEducation]:
        rows = await self._db.scalars(
            select(ApplicationEducation)
            .where(ApplicationEducation.application_id == application_id)
            .order_by(ApplicationEducation.sort_order)
        )
        return [
            ProfileEducation(
                institution=row.institution,
                degree=row.degree,
                field_of_study=row.field_of_study,
                graduation_year=row.graduation_year,
                description=row.description,
            )
            for row in rows
        ]

    async def _languages(self, application_id: UUID) -> list[ProfileLanguage]:
        rows = await self._db.scalars(
            select(ApplicationLanguage)
            .where(ApplicationLanguage.application_id == application_id)
            .order_by(ApplicationLanguage.sort_order)
        )
        return [
            ProfileLanguage(code=row.language_code, proficiency=row.proficiency) for row in rows
        ]

    async def _projects(self, application_id: UUID) -> list[ProfileProject]:
        rows = await self._db.scalars(
            select(ApplicationProject)
            .where(ApplicationProject.application_id == application_id)
            .order_by(ApplicationProject.sort_order)
        )
        return [
            ProfileProject(
                name=row.name,
                description=row.description,
                project_url=row.project_url,
                repository_url=row.repository_url,
                start_year=row.start_year,
                start_month=row.start_month,
                end_year=row.end_year,
                end_month=row.end_month,
            )
            for row in rows
        ]

    async def _skills(self, application_id: UUID) -> list[ProfileSkill]:
        rows = await self._db.execute(
            select(SkillTaxonomy.canonical_name, ApplicationSkill.years_experience)
            .join(SkillTaxonomy, SkillTaxonomy.id == ApplicationSkill.taxonomy_id)
            .where(ApplicationSkill.application_id == application_id)
            .order_by(ApplicationSkill.sort_order)
        )
        return [
            ProfileSkill(name=name, years_experience=None if years is None else float(years))
            for name, years in rows.tuples()
        ]

    async def _answers(self, application_id: UUID) -> list[AnsweredQuestion]:
        rows = await self._db.execute(
            select(ApplicationAnswer, JobApplicationQuestion)
            .join(
                JobApplicationQuestion,
                JobApplicationQuestion.id == ApplicationAnswer.question_id,
            )
            .where(ApplicationAnswer.application_id == application_id)
            .order_by(JobApplicationQuestion.sort_order)
        )
        return [
            AnsweredQuestion(
                question_id=question.id,
                question_text=question.question_text,
                question_type=question.question_type,
                answer_boolean=answer.answer_boolean,
                answer_text=answer.answer_text,
            )
            for answer, question in rows.tuples()
        ]

    async def _history(self, application_id: UUID) -> list[StatusChange]:
        rows = await self._db.scalars(
            select(ApplicationStatusHistory)
            .where(ApplicationStatusHistory.application_id == application_id)
            .order_by(ApplicationStatusHistory.created_at, ApplicationStatusHistory.id)
        )
        return [
            StatusChange(
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


def _summary(application: Application, snapshot: ApplicationProfileSnapshot) -> ApplicantSummary:
    return ApplicantSummary(
        id=application.id,
        candidate_name=snapshot.full_name,
        headline=snapshot.headline,
        location=snapshot.location,
        status=application.status,
        qualification_status=application.qualification_status,
        applied_at=application.applied_at,
        updated_at=application.updated_at,
    )


def _cursor(row: tuple[Application, ApplicationProfileSnapshot]) -> Cursor:
    application, _snapshot = row
    return Cursor(created_at=application.applied_at, id=application.id)
