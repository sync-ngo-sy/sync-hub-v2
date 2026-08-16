"""Reading one Application against its Job, from the rows both were frozen into.

The API and the worker both assess, and this is the half they share: what the model is shown,
and the row a reading becomes. Keeping it here rather than in either caller is what makes the
automatic reading and the one a Recruiter asks for the same reading — the same Snapshot, the
same criteria, the same prompt version — differing only in who started it.

What the model is shown is the frozen Snapshot, never the live profile: an assessment says how
the Application was sent, not how its author reads today. The Job's side is read as it stands,
which is the same thing — a Job with Applications has its criteria locked.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from sync_assessments.assessor import (
    AskedQuestion,
    AssessedApplication,
    AssessedJob,
    BuiltProject,
    HeldEducation,
    HeldExperience,
    HeldSkill,
    MatchRequest,
    RequiredLanguage,
    RequiredSkill,
    SpokenLanguage,
)
from sync_assessments.prompt import PROMPT_VERSION
from sync_core import get_logger
from sync_core.models import (
    Application,
    ApplicationAiMatchAssessment,
    ApplicationAnswer,
    ApplicationEducation,
    ApplicationExperience,
    ApplicationLanguage,
    ApplicationProfileSnapshot,
    ApplicationProject,
    ApplicationSkill,
    Job,
    JobApplicationQuestion,
    JobLanguage,
    JobSkill,
    Language,
    Location,
    SkillTaxonomy,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.sql.dml import ReturningInsert

    from sync_assessments.assessor import MatchAssessor
    from sync_assessments.schema import AssessedMatch
    from sync_core import Database

logger = get_logger(__name__)


class ApplicationGoneError(Exception):
    """There is nothing left to read. Asking again would find the same absence."""


class MatchAssessing:
    """The worker's side: read the Application, ask the model, hand back a row to write.

    Split in three the way every queue consumer here is — the database work either side of a
    call that takes seconds, so no Postgres connection is held across it.
    """

    def __init__(self, database: Database, assessor: MatchAssessor) -> None:
        self._database = database
        self._assessor = assessor

    async def assess(self, application_id: UUID) -> AssessedMatch:
        async with self._database.session() as session:
            request = await match_request(session, application_id)
        return await self._assessor.assess(request)

    async def store(
        self, session: AsyncSession, application_id: UUID, assessed: AssessedMatch
    ) -> None:
        """The Application's reading, replacing whatever it had. The Match score follows in the
        database, so nothing here has to remember to move it."""
        await session.execute(
            record_the_reading(application_id, assessed, model_name=self._assessor.model)
        )
        logger.info(
            "assessments.recorded",
            application_id=str(application_id),
            model_name=self._assessor.model,
            prompt_version=PROMPT_VERSION,
            match_percentage=assessed.match_percentage,
        )


def record_the_reading(
    application_id: UUID, assessed: AssessedMatch, *, model_name: str
) -> ReturningInsert[tuple[ApplicationAiMatchAssessment]]:
    """The Application's one reading, written or replaced in a single statement.

    An Application carries one reading, and asking again is asking for a better one rather than
    for a second: the row is overwritten where it stands. Which makes the upsert the whole
    concurrency story too — the worker's automatic reading and a Recruiter's own request can
    race, and the loser updates the winner's row instead of failing on the unique constraint.

    The model and the prompt version are overwritten with it, because they describe the reading
    that is there now. A number written under today's instructions must never be left wearing
    the stamp of the ones it replaced.
    """
    written = {
        "match_percentage": _stored_percentage(assessed.match_percentage),
        "explanation": assessed.explanation,
        "assessment_details": {"strengths": assessed.strengths, "gaps": assessed.gaps},
        "model_name": model_name,
        "prompt_version": PROMPT_VERSION,
    }
    return (
        insert(ApplicationAiMatchAssessment)
        .values(application_id=application_id, **written)
        .on_conflict_do_update(
            index_elements=[ApplicationAiMatchAssessment.application_id], set_=written
        )
        .returning(ApplicationAiMatchAssessment)
    )


async def match_request(session: AsyncSession, application_id: UUID) -> MatchRequest:
    """Everything one reading is made of: the Job's bar, and the Snapshot answering it."""
    job, place = await _job_of(session, application_id)
    return MatchRequest(
        job=AssessedJob(
            title=job.title,
            description=job.description,
            location=place,
            employment_type=job.employment_type,
            minimum_total_experience_years=job.minimum_total_experience_years,
            skills=await _required_skills(session, job.id),
            languages=await _required_languages(session, job.id),
        ),
        application=await _applied(session, application_id),
    )


async def _job_of(session: AsyncSession, application_id: UUID) -> tuple[Job, str | None]:
    """The Job the Application came in for, and what its Location is called."""
    found = (
        await session.execute(
            select(Job, Location.name)
            .join(Application, Application.job_id == Job.id)
            .outerjoin(Location, Location.key == Job.location_key)
            .where(Application.id == application_id)
        )
    ).first()
    if found is None:
        raise ApplicationGoneError(f"application {application_id} no longer exists")
    job: Job = found[0]
    place: str | None = found[1]
    return job, place


async def _required_skills(session: AsyncSession, job_id: UUID) -> tuple[RequiredSkill, ...]:
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, JobSkill.importance, JobSkill.minimum_years)
        .join(SkillTaxonomy, SkillTaxonomy.id == JobSkill.taxonomy_id)
        .where(JobSkill.job_id == job_id)
        .order_by(SkillTaxonomy.canonical_name)
    )
    return tuple(
        RequiredSkill(name=name, importance=importance, minimum_years=minimum_years)
        for name, importance, minimum_years in rows.tuples()
    )


async def _required_languages(session: AsyncSession, job_id: UUID) -> tuple[RequiredLanguage, ...]:
    rows = await session.execute(
        select(Language.name, JobLanguage.minimum_proficiency)
        .join(Language, Language.code == JobLanguage.language_code)
        .where(JobLanguage.job_id == job_id)
        .order_by(JobLanguage.language_code)
    )
    return tuple(
        RequiredLanguage(name=name, minimum_proficiency=minimum) for name, minimum in rows.tuples()
    )


async def _applied(session: AsyncSession, application_id: UUID) -> AssessedApplication:
    snapshot = await session.get(ApplicationProfileSnapshot, application_id)
    if snapshot is None:
        raise ApplicationGoneError(f"application {application_id} has no snapshot")
    return AssessedApplication(
        headline=snapshot.headline,
        summary=snapshot.summary,
        location=snapshot.location,
        total_experience_years=snapshot.total_experience_years,
        experiences=await _experiences(session, application_id),
        educations=await _educations(session, application_id),
        skills=await _skills(session, application_id),
        languages=await _languages(session, application_id),
        projects=await _projects(session, application_id),
        answers=await _answers(session, application_id),
    )


async def _experiences(session: AsyncSession, application_id: UUID) -> tuple[HeldExperience, ...]:
    rows = await session.scalars(
        select(ApplicationExperience)
        .where(ApplicationExperience.application_id == application_id)
        .order_by(ApplicationExperience.sort_order)
    )
    return tuple(
        HeldExperience(
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
    )


async def _educations(session: AsyncSession, application_id: UUID) -> tuple[HeldEducation, ...]:
    rows = await session.scalars(
        select(ApplicationEducation)
        .where(ApplicationEducation.application_id == application_id)
        .order_by(ApplicationEducation.sort_order)
    )
    return tuple(
        HeldEducation(
            institution=row.institution,
            degree=row.degree,
            field_of_study=row.field_of_study,
            graduation_year=row.graduation_year,
        )
        for row in rows
    )


async def _skills(session: AsyncSession, application_id: UUID) -> tuple[HeldSkill, ...]:
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, ApplicationSkill.years_experience)
        .join(SkillTaxonomy, SkillTaxonomy.id == ApplicationSkill.taxonomy_id)
        .where(ApplicationSkill.application_id == application_id)
        .order_by(ApplicationSkill.sort_order)
    )
    return tuple(HeldSkill(name=name, years_experience=years) for name, years in rows.tuples())


async def _languages(session: AsyncSession, application_id: UUID) -> tuple[SpokenLanguage, ...]:
    """The model reads "Arabic" rather than "ar" — the words a recruiter would use. A code the
    reference table has never heard of is shown as itself rather than dropped."""
    rows = await session.execute(
        select(ApplicationLanguage.language_code, Language.name, ApplicationLanguage.proficiency)
        .outerjoin(Language, Language.code == ApplicationLanguage.language_code)
        .where(ApplicationLanguage.application_id == application_id)
        .order_by(ApplicationLanguage.sort_order)
    )
    return tuple(
        SpokenLanguage(name=name or code, proficiency=proficiency)
        for code, name, proficiency in rows.tuples()
    )


async def _projects(session: AsyncSession, application_id: UUID) -> tuple[BuiltProject, ...]:
    rows = await session.scalars(
        select(ApplicationProject)
        .where(ApplicationProject.application_id == application_id)
        .order_by(ApplicationProject.sort_order)
    )
    return tuple(BuiltProject(name=row.name, description=row.description) for row in rows)


async def _answers(session: AsyncSession, application_id: UUID) -> tuple[AskedQuestion, ...]:
    rows = await session.execute(
        select(
            JobApplicationQuestion.question_text,
            ApplicationAnswer.answer_boolean,
            ApplicationAnswer.answer_text,
        )
        .join(
            JobApplicationQuestion,
            JobApplicationQuestion.id == ApplicationAnswer.question_id,
        )
        .where(ApplicationAnswer.application_id == application_id)
        .order_by(JobApplicationQuestion.sort_order)
    )
    return tuple(
        AskedQuestion(question=question, answer=_spoken(boolean, written))
        for question, boolean, written in rows.tuples()
    )


def _spoken(answer_boolean: bool | None, answer_text: str | None) -> str:
    if answer_boolean is not None:
        return "yes" if answer_boolean else "no"
    return answer_text or ""


def _stored_percentage(match_percentage: float) -> Decimal:
    """Through `str`, so the column is given the number the model said rather than the binary
    float nearest to it."""
    return Decimal(str(match_percentage))
