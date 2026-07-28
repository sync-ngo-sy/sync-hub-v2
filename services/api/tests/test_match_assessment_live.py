from __future__ import annotations

import os
from decimal import Decimal

import pytest

from sync_assessments import (
    AssessedApplication,
    AssessedJob,
    HeldExperience,
    HeldSkill,
    MatchRequest,
    RequiredSkill,
)
from sync_assessments.openai_assessor import OpenAiMatchAssessor
from sync_core import get_settings
from sync_core.models import SkillImportance

pytestmark = [
    pytest.mark.ai_live,
    pytest.mark.skipif(
        not os.environ.get("SYNC_OPENAI_API_KEY"),
        reason="SYNC_OPENAI_API_KEY is not set",
    ),
]

A_JOB = AssessedJob(
    title="Senior Backend Engineer",
    description="Build and run the payment platform: Python services on PostgreSQL, and the "
    "ledger behind them.",
    location="Damascus, Syria",
    minimum_total_experience_years=Decimal("5.0"),
    skills=(
        RequiredSkill(name="Python", importance=SkillImportance.REQUIRED, minimum_years=5),
        RequiredSkill(name="PostgreSQL", importance=SkillImportance.REQUIRED, minimum_years=None),
        RequiredSkill(name="Docker", importance=SkillImportance.PREFERRED, minimum_years=None),
    ),
)

AN_ANSWERING_APPLICATION = AssessedApplication(
    headline="Backend engineer, 8 years",
    summary="Builds payment systems in Python and PostgreSQL.",
    location="Damascus, Syria",
    experiences=(
        HeldExperience(
            job_title="Senior Engineer",
            company_name="Acme Payments",
            start_year=2018,
            start_month=1,
            is_current=True,
            description="Ran the double-entry ledger and the settlement service.",
        ),
    ),
    skills=(
        HeldSkill(name="Python", years_experience=Decimal("8.0")),
        HeldSkill(name="PostgreSQL", years_experience=Decimal("7.0")),
    ),
)

AN_UNRELATED_APPLICATION = AssessedApplication(
    headline="Pastry chef",
    summary="Croissants, and the ovens that ruin them.",
    location="Paris, France",
    experiences=(
        HeldExperience(
            job_title="Head pastry chef",
            company_name="Boulangerie Rive",
            start_year=2019,
            start_month=6,
            is_current=True,
        ),
    ),
)


@pytest.fixture
def assessor() -> OpenAiMatchAssessor:
    settings = get_settings()
    assert settings.openai_api_key is not None
    return OpenAiMatchAssessor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_assessment_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


async def test_a_real_assessment_comes_back_as_a_percentage_and_a_reading(
    assessor: OpenAiMatchAssessor,
) -> None:
    assessed = await assessor.assess(MatchRequest(job=A_JOB, application=AN_ANSWERING_APPLICATION))

    assert 0 <= assessed.match_percentage <= 100
    assert assessed.explanation.strip()
    assert assessed.strengths


async def test_the_real_model_scores_the_application_that_answers_the_job_higher(
    assessor: OpenAiMatchAssessor,
) -> None:
    answering, unrelated = (
        await assessor.assess(MatchRequest(job=A_JOB, application=AN_ANSWERING_APPLICATION)),
        await assessor.assess(MatchRequest(job=A_JOB, application=AN_UNRELATED_APPLICATION)),
    )

    assert answering.match_percentage > unrelated.match_percentage
    assert unrelated.gaps
