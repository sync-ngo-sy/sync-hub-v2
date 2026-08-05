from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.applications.screening import (
    Criteria,
    KnockoutQuestion,
    LanguageCriterion,
    SkillCriterion,
)
from sync_api.jobs.criteria import questions_of
from sync_core.models import JobLanguage, JobSkill, Language, SkillTaxonomy

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core.models import Job, JobApplicationQuestion


async def screening_criteria_of(
    session: AsyncSession, job: Job, questions: Sequence[JobApplicationQuestion] | None = None
) -> Criteria:
    """The Job's bar, in the shape Screening measures against.

    `questions` for a caller that has already read them — a submission validates the answers
    against the same list this screens by, and reading it twice was two identical statements one
    after the other. Left out, they are read here.
    """
    return Criteria(
        minimum_total_experience_years=job.minimum_total_experience_years,
        skills=await _skills(session, job.id),
        languages=await _languages(session, job.id),
        knockouts=_knockouts(
            await questions_of(session, job.id) if questions is None else questions
        ),
    )


async def _skills(session: AsyncSession, job_id: UUID) -> tuple[SkillCriterion, ...]:
    rows = await session.execute(
        select(
            JobSkill.taxonomy_id,
            SkillTaxonomy.canonical_name,
            JobSkill.importance,
            JobSkill.minimum_years,
        )
        .join(SkillTaxonomy, SkillTaxonomy.id == JobSkill.taxonomy_id)
        .where(JobSkill.job_id == job_id)
        .order_by(SkillTaxonomy.canonical_name)
    )
    return tuple(
        SkillCriterion(
            taxonomy_id=taxonomy_id, name=name, importance=importance, minimum_years=minimum_years
        )
        for taxonomy_id, name, importance, minimum_years in rows.tuples()
    )


async def _languages(session: AsyncSession, job_id: UUID) -> tuple[LanguageCriterion, ...]:
    rows = await session.execute(
        select(JobLanguage.language_code, Language.name, JobLanguage.minimum_proficiency)
        .join(Language, Language.code == JobLanguage.language_code)
        .where(JobLanguage.job_id == job_id)
        .order_by(JobLanguage.language_code)
    )
    return tuple(
        LanguageCriterion(code=code, name=name, minimum_proficiency=minimum)
        for code, name, minimum in rows.tuples()
    )


def _knockouts(questions: Sequence[JobApplicationQuestion]) -> tuple[KnockoutQuestion, ...]:
    """A question only screens where the Recruiter said which answer gets past it."""
    return tuple(
        KnockoutQuestion(
            question_id=question.id,
            question_text=question.question_text,
            accepted_boolean_answer=question.accepted_boolean_answer,
        )
        for question in questions
        if question.accepted_boolean_answer is not None
    )
