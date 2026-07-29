from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.applications.access import own_application
from sync_api.applications.criteria import screening_criteria_of
from sync_api.applications.payload import MatchAssessment, MatchAssessmentPage
from sync_api.applications.snapshot import answers_of, snapshot_of
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    ASSESSMENT_FAILED_PROBLEM_TYPE,
    ASSESSMENT_UNAVAILABLE_PROBLEM_TYPE,
    Problem,
)
from sync_assessments import (
    PROMPT_VERSION,
    AskedQuestion,
    AssessedApplication,
    AssessedJob,
    AssessmentError,
    BuiltProject,
    HeldEducation,
    HeldExperience,
    HeldSkill,
    MatchRequest,
    RequiredLanguage,
    RequiredSkill,
    SpokenLanguage,
)
from sync_core import get_logger, transaction
from sync_core.models import ApplicationAiMatchAssessment, Language
from sync_core.profile import as_decimal

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.applications.access import Applied
    from sync_api.applications.payload import AnsweredQuestion, ApplicationSnapshot
    from sync_api.tenants import ActingRecruiter
    from sync_assessments import AssessedMatch, MatchAssessor

logger = get_logger(__name__)


class MatchAssessmentService:
    """The Recruiter's second opinion on an Application: on demand, append-only, advisory.

    The Candidate's side of what it reads is the immutable Snapshot, never the live profile:
    an assessment says how the Application was sent, not how its author reads today. The
    Job's side is the criteria Screening measured plus the Job's own words, which is what
    lets a model say anything Screening could not — and which it reads as they stand, since
    only the criteria are locked once Applications arrive.

    What it writes is one more row. No assessment, however many are run, is a word in the
    Screening verdict.
    """

    def __init__(self, session: AsyncSession, assessor: MatchAssessor | None) -> None:
        self._db = session
        self._assessor = assessor

    async def assess(self, recruiter: ActingRecruiter, application_id: UUID) -> MatchAssessment:
        tenant_id = recruiter.tenant.id
        applied = await own_application(self._db, tenant_id, application_id)
        assessor = self._configured()
        request = await self._request(applied)

        # A model answers in its own time and nothing has been written yet, so the read's
        # transaction is let go of rather than held — with it, its Postgres connection —
        # across the call. Every row read above has been copied into `request` by now.
        await self._db.rollback()
        assessed = await _answered(assessor, request)

        row = ApplicationAiMatchAssessment(
            application_id=application_id,
            match_percentage=Decimal(str(assessed.match_percentage)),
            explanation=assessed.explanation,
            assessment_details={"strengths": assessed.strengths, "gaps": assessed.gaps},
            model_name=assessor.model,
            prompt_version=PROMPT_VERSION,
        )
        async with transaction(self._db):
            self._db.add(row)
            await self._db.flush()

        logger.info(
            "applications.assessed",
            application_id=str(application_id),
            tenant_id=str(tenant_id),
            model_name=assessor.model,
            prompt_version=PROMPT_VERSION,
            match_percentage=float(row.match_percentage),
        )
        return _view(row)

    async def page(
        self,
        recruiter: ActingRecruiter,
        application_id: UUID,
        *,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> MatchAssessmentPage:
        await own_application(self._db, recruiter.tenant.id, application_id)
        found = list(
            await self._db.scalars(
                newest_first(
                    select(ApplicationAiMatchAssessment).where(
                        ApplicationAiMatchAssessment.application_id == application_id
                    ),
                    created_at=ApplicationAiMatchAssessment.created_at,
                    id_=ApplicationAiMatchAssessment.id,
                    cursor=cursor,
                    limit=limit,
                )
            )
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return MatchAssessmentPage(items=[_view(row) for row in rows], next_cursor=next_cursor)

    def _configured(self) -> MatchAssessor:
        """Reading what was assessed never depends on a model; asking for another one does."""
        if self._assessor is None:
            raise Problem(
                status=503,
                type=ASSESSMENT_UNAVAILABLE_PROBLEM_TYPE,
                detail="AI match assessment is not configured on this deployment.",
            )
        return self._assessor

    async def _request(self, applied: Applied) -> MatchRequest:
        job = applied.job
        criteria = await screening_criteria_of(self._db, job)
        return MatchRequest(
            job=AssessedJob(
                title=job.title,
                description=job.description,
                location=job.location,
                employment_type=job.employment_type,
                minimum_total_experience_years=criteria.minimum_total_experience_years,
                skills=tuple(
                    RequiredSkill(
                        name=skill.name,
                        importance=skill.importance,
                        minimum_years=skill.minimum_years,
                    )
                    for skill in criteria.skills
                ),
                languages=tuple(
                    RequiredLanguage(
                        name=language.name, minimum_proficiency=language.minimum_proficiency
                    )
                    for language in criteria.languages
                ),
            ),
            application=await self._applied(applied.application.id),
        )

    async def _applied(self, application_id: UUID) -> AssessedApplication:
        snapshot = await snapshot_of(self._db, application_id)
        answers = await answers_of(self._db, application_id)
        spoken = await self._language_names(snapshot)
        return AssessedApplication(
            headline=snapshot.headline,
            summary=snapshot.summary,
            location=snapshot.location,
            experiences=tuple(
                HeldExperience(
                    job_title=entry.job_title,
                    company_name=entry.company_name,
                    start_year=entry.start_year,
                    start_month=entry.start_month,
                    end_year=entry.end_year,
                    end_month=entry.end_month,
                    is_current=entry.is_current,
                    description=entry.description,
                )
                for entry in snapshot.experiences
            ),
            educations=tuple(
                HeldEducation(
                    institution=entry.institution,
                    degree=entry.degree,
                    field_of_study=entry.field_of_study,
                    graduation_year=entry.graduation_year,
                )
                for entry in snapshot.educations
            ),
            skills=tuple(
                HeldSkill(name=entry.name, years_experience=as_decimal(entry.years_experience))
                for entry in snapshot.skills
            ),
            languages=tuple(
                SpokenLanguage(
                    name=spoken.get(entry.code, entry.code), proficiency=entry.proficiency
                )
                for entry in snapshot.languages
            ),
            projects=tuple(
                BuiltProject(name=entry.name, description=entry.description)
                for entry in snapshot.projects
            ),
            answers=tuple(
                AskedQuestion(question=answer.question_text, answer=_spoken_answer(answer))
                for answer in answers
            ),
        )

    async def _language_names(self, snapshot: ApplicationSnapshot) -> dict[str, str]:
        """The model reads "Arabic" rather than "ar" — the words a recruiter would use."""
        codes = [entry.code for entry in snapshot.languages]
        if not codes:
            return {}
        rows = await self._db.execute(
            select(Language.code, Language.name).where(Language.code.in_(codes))
        )
        return dict(rows.tuples().all())


async def _answered(assessor: MatchAssessor, request: MatchRequest) -> AssessedMatch:
    try:
        return await assessor.assess(request)
    except AssessmentError as failed:
        raise Problem(
            status=502,
            type=ASSESSMENT_FAILED_PROBLEM_TYPE,
            detail="The model could not assess this application. Nothing was recorded, so "
            "asking again is safe.",
        ) from failed


def _view(row: ApplicationAiMatchAssessment) -> MatchAssessment:
    details = row.assessment_details or {}
    return MatchAssessment(
        id=row.id,
        match_percentage=float(row.match_percentage),
        explanation=row.explanation,
        strengths=_phrases(details.get("strengths")),
        gaps=_phrases(details.get("gaps")),
        model_name=row.model_name,
        prompt_version=row.prompt_version,
        assessed_at=row.created_at,
    )


def _phrases(written: object) -> list[str]:
    """`assessment_details` is jsonb, and a row an older prompt version wrote is still read
    by this one — whatever shape it left behind."""
    return [str(entry) for entry in written] if isinstance(written, list) else []


def _spoken_answer(answer: AnsweredQuestion) -> str:
    if answer.answer_boolean is not None:
        return "yes" if answer.answer_boolean else "no"
    return answer.answer_text or ""


def _cursor(row: ApplicationAiMatchAssessment) -> Cursor:
    return Cursor(created_at=row.created_at, id=row.id)
