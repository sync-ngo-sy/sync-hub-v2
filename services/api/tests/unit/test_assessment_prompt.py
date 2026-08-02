from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

import pytest

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
from sync_core.models import EmploymentType, LanguageProficiency, SkillImportance

A_JOB = AssessedJob(
    title="Senior Backend Engineer",
    description="Build and run the payment platform.",
    location="Damascus, Syria",
    employment_type=EmploymentType.FULL_TIME,
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


def test_the_employment_type_reads_as_english_rather_than_as_its_stored_value() -> None:
    """The model reads prose, and `full_time` is not prose. The word is the one the portals put
    on screen, so the document did not change when the column became an enum."""
    document = as_document(MatchRequest(job=A_JOB, application=AN_APPLICATION))

    assert "Employment type: Full time" in document


@pytest.mark.parametrize("kind", list(EmploymentType))
def test_every_employment_type_has_a_word_the_model_can_read(kind: EmploymentType) -> None:
    """The portals get this from the type checker — a `Record` keyed by the union will not
    compile with a member missing. Python's dict will not, so the test is the check: adding a
    seventh employment type without a word here would otherwise raise mid-assessment."""
    document = as_document(
        MatchRequest(job=replace(A_JOB, employment_type=kind), application=AN_APPLICATION)
    )

    assert "Employment type: " in document
    assert kind.value not in document


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
