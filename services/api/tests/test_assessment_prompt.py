from __future__ import annotations

from decimal import Decimal

from sync_assessments import (
    AskedQuestion,
    AssessedApplication,
    AssessedJob,
    HeldEducation,
    HeldExperience,
    HeldSkill,
    MatchRequest,
    RequiredLanguage,
    RequiredSkill,
    SpokenLanguage,
    as_document,
)
from sync_core.models import LanguageProficiency, SkillImportance

A_JOB = AssessedJob(
    title="Senior Backend Engineer",
    description="Build and run the payment platform.",
    location="Damascus, Syria",
    employment_type="Full time",
    minimum_total_experience_years=Decimal("5.0"),
    skills=(
        RequiredSkill(name="Docker", importance=SkillImportance.PREFERRED),
        RequiredSkill(name="Python", importance=SkillImportance.REQUIRED, minimum_years=5),
    ),
    languages=(RequiredLanguage(name="Arabic", minimum_proficiency=LanguageProficiency.FLUENT),),
)

AN_APPLICATION = AssessedApplication(
    headline="Backend engineer, 8 years",
    summary="Builds payment systems that stay up.",
    location="Damascus, Syria",
    experiences=(
        HeldExperience(
            job_title="Senior Engineer",
            company_name="Acme",
            start_year=2018,
            start_month=1,
            is_current=True,
            description="Ran the ledger.",
        ),
        HeldExperience(job_title="Engineer", start_year=2015, end_year=2017, end_month=12),
    ),
    educations=(
        HeldEducation(
            institution="Damascus University",
            degree="BSc",
            field_of_study="Computer Science",
            graduation_year=2017,
        ),
    ),
    skills=(
        HeldSkill(name="Python", years_experience=Decimal("8.0")),
        HeldSkill(name="PostgreSQL"),
    ),
    languages=(SpokenLanguage(name="Arabic", proficiency=LanguageProficiency.NATIVE),),
    answers=(AskedQuestion(question="Right to work in Syria?", answer="yes"),),
)


def test_the_document_separates_what_the_job_requires_from_what_it_prefers() -> None:
    document = as_document(MatchRequest(job=A_JOB, application=AN_APPLICATION))

    assert "Required skills: Python (at least 5 years)" in document
    assert "Preferred skills: Docker" in document
    assert "Required languages: Arabic (at least fluent)" in document
    assert "Minimum total experience: 5.0 years" in document


def test_the_document_carries_the_evidence_the_application_gave() -> None:
    document = as_document(MatchRequest(job=A_JOB, application=AN_APPLICATION))

    assert "Senior Engineer at Acme (2018-01 to now): Ran the ledger." in document
    assert "Engineer (2015 to 2017-12)" in document
    assert "BSc in Computer Science — Damascus University, 2017" in document
    assert "Python (8.0 years)" in document
    assert "PostgreSQL (years not stated)" in document
    assert "“Right to work in Syria?” — yes" in document


def test_an_empty_section_is_left_out_rather_than_shown_as_nothing() -> None:
    document = as_document(
        MatchRequest(job=A_JOB, application=AssessedApplication(headline="Engineer"))
    )

    assert "Experience:" not in document
    assert "Education:" not in document
    assert "Projects:" not in document
    assert "Answers" not in document
