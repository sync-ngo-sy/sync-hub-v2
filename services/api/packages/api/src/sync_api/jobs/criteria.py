from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.jobs.payload import (
    JobCriteriaView,
    JobLanguageRequirement,
    JobQuestionView,
    JobSkillRequirement,
    PublicJobQuestion,
)
from sync_core.models import JobApplicationQuestion, JobLanguage, JobSkill, SkillTaxonomy

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core.models import Job


async def criteria_of(session: AsyncSession, job: Job) -> JobCriteriaView:
    return JobCriteriaView(
        minimum_total_experience_years=minimum_experience_of(job),
        skills=await skills_of(session, job.id),
        languages=await languages_of(session, job.id),
        questions=await question_views_of(session, job.id),
    )


async def skills_of(session: AsyncSession, job_id: UUID) -> list[JobSkillRequirement]:
    """Alphabetical: `job_skills` records no order of its own, so this is the stable one."""
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, JobSkill.importance, JobSkill.minimum_years)
        .join(SkillTaxonomy, SkillTaxonomy.id == JobSkill.taxonomy_id)
        .where(JobSkill.job_id == job_id)
        .order_by(SkillTaxonomy.canonical_name)
    )
    return [
        JobSkillRequirement(name=name, importance=importance, minimum_years=minimum_years)
        for name, importance, minimum_years in rows.tuples()
    ]


async def languages_of(session: AsyncSession, job_id: UUID) -> list[JobLanguageRequirement]:
    rows = await session.scalars(
        select(JobLanguage).where(JobLanguage.job_id == job_id).order_by(JobLanguage.language_code)
    )
    return [
        JobLanguageRequirement(code=row.language_code, minimum_proficiency=row.minimum_proficiency)
        for row in rows
    ]


async def question_views_of(session: AsyncSession, job_id: UUID) -> list[JobQuestionView]:
    rows = await questions_of(session, job_id)
    return [
        JobQuestionView(
            id=row.id,
            question_text=row.question_text,
            question_type=row.question_type,
            is_required=row.is_required,
            accepted_boolean_answer=row.accepted_boolean_answer,
        )
        for row in rows
    ]


async def public_questions_of(session: AsyncSession, job_id: UUID) -> list[PublicJobQuestion]:
    """Without `accepted_boolean_answer`: which answer passes is the Job's, not the applicant's."""
    rows = await questions_of(session, job_id)
    return [
        PublicJobQuestion(
            id=row.id,
            question_text=row.question_text,
            question_type=row.question_type,
            is_required=row.is_required,
        )
        for row in rows
    ]


async def questions_of(session: AsyncSession, job_id: UUID) -> list[JobApplicationQuestion]:
    """Every question of the Job, in the order applicants are asked them."""
    rows = await session.scalars(
        select(JobApplicationQuestion)
        .where(JobApplicationQuestion.job_id == job_id)
        .order_by(JobApplicationQuestion.sort_order)
    )
    return list(rows)


def minimum_experience_of(job: Job) -> float | None:
    """`numeric(4,1)` reads back as a `Decimal`, which JSON has no use for."""
    return (
        None
        if job.minimum_total_experience_years is None
        else float(job.minimum_total_experience_years)
    )
