from __future__ import annotations

import pytest

from sync_core.models import LanguageProficiency
from sync_core.profile import MAX_ENTRIES, MAX_LINE_LENGTH, MAX_PARAGRAPH_LENGTH
from sync_ingestion import reviewable
from sync_ingestion.review import Vocabularies
from sync_parsers import (
    ParsedCv,
    ParsedEducation,
    ParsedExperience,
    ParsedLanguage,
    ParsedProject,
    ParsedSkill,
)
from tests.support.extractors import a_parse

KNOWN = Vocabularies(
    taxonomy={"python": "Python", "postgresql": "PostgreSQL", "react": "React"},
    roles={"backend-engineer": "backend-engineer", "frontend-engineer": "frontend-engineer"},
    languages={"en": "en", "ar": "ar"},
)


def reviewed(**changes: object) -> ParsedCv:
    return reviewable(a_parse(**changes), KNOWN)


def an_experience(**changes: object) -> ParsedExperience:
    return ParsedExperience(
        job_title="Engineer",
        company_name=None,
        start_year=2020,
        start_month=1,
        end_year=None,
        end_month=None,
        is_current=False,
        description=None,
    ).model_copy(update=changes)


def a_project(**changes: object) -> ParsedProject:
    return ParsedProject(
        name="Sync",
        description=None,
        project_url=None,
        repository_url=None,
        start_year=2024,
        start_month=None,
        end_year=None,
        end_month=None,
    ).model_copy(update=changes)


def test_a_canonical_skill_survives_in_the_platforms_spelling() -> None:
    parse = reviewed(skills=[ParsedSkill(name="  pYtHoN ", years_experience=8.0)])

    assert parse.skills == [ParsedSkill(name="Python", years_experience=8.0)]


def test_an_unknown_skill_is_demoted_rather_than_dropped() -> None:
    parse = reviewed(
        skills=[
            ParsedSkill(name="Python", years_experience=None),
            ParsedSkill(name="Telepathy", years_experience=20.0),
        ],
        unmapped_skills=[],
    )

    assert [skill.name for skill in parse.skills] == ["Python"]
    assert parse.unmapped_skills == ["Telepathy"]


def test_a_skill_listed_twice_becomes_one_entry() -> None:
    parse = reviewed(
        skills=[
            ParsedSkill(name="Python", years_experience=8.0),
            ParsedSkill(name="python", years_experience=2.0),
        ]
    )

    assert parse.skills == [ParsedSkill(name="Python", years_experience=8.0)]


@pytest.mark.parametrize("given,kept", [(-1.0, None), (0.0, 0.0), (8.26, 8.3), (10_000.0, 999.9)])
def test_years_of_experience_are_fitted_to_the_column(given: float, kept: float | None) -> None:
    parse = reviewed(skills=[ParsedSkill(name="Python", years_experience=given)])

    assert parse.skills[0].years_experience == kept


def test_an_unmapped_skill_is_listed_once() -> None:
    parse = reviewed(skills=[], unmapped_skills=["Telepathy", "telepathy", "  Telepathy  "])

    assert parse.unmapped_skills == ["Telepathy"]


def test_a_language_the_platform_knows_is_kept_by_its_code() -> None:
    parse = reviewed(
        languages=[ParsedLanguage(code=" AR ", proficiency=LanguageProficiency.NATIVE)]
    )

    assert parse.languages == [ParsedLanguage(code="ar", proficiency=LanguageProficiency.NATIVE)]


def test_a_language_the_platform_has_no_code_for_is_dropped() -> None:
    parse = reviewed(
        languages=[
            ParsedLanguage(code="en", proficiency=LanguageProficiency.FLUENT),
            ParsedLanguage(code="tlh", proficiency=LanguageProficiency.NATIVE),
        ]
    )

    assert [language.code for language in parse.languages] == ["en"]


def test_the_language_a_cv_is_written_in_is_kept_by_its_code() -> None:
    parse = reviewed(detected_language=" AR ")

    assert parse.detected_language == "ar"


def test_a_detected_language_the_platform_has_no_code_for_records_nothing() -> None:
    parse = reviewed(detected_language="arabic")

    assert parse.detected_language is None


def test_a_language_claimed_twice_becomes_one_entry() -> None:
    parse = reviewed(
        languages=[
            ParsedLanguage(code="en", proficiency=LanguageProficiency.FLUENT),
            ParsedLanguage(code="EN", proficiency=LanguageProficiency.BEGINNER),
        ]
    )

    assert parse.languages == [ParsedLanguage(code="en", proficiency=LanguageProficiency.FLUENT)]


@pytest.mark.parametrize("year", [1291, 1899, 2101, 9999])
def test_a_year_outside_the_schemas_range_is_forgotten(year: int) -> None:
    parse = reviewed(experiences=[an_experience(start_year=year)])

    assert parse.experiences[0].start_year is None


@pytest.mark.parametrize("month", [0, 13, 99])
def test_a_month_that_is_not_a_month_is_forgotten(month: int) -> None:
    parse = reviewed(experiences=[an_experience(start_month=month)])

    assert parse.experiences[0].start_month is None


def test_a_period_that_ends_before_it_starts_loses_its_end() -> None:
    parse = reviewed(experiences=[an_experience(start_year=2020, end_year=2015)])

    assert parse.experiences[0].start_year == 2020
    assert parse.experiences[0].end_year is None


def test_a_period_ending_the_month_it_started_is_kept() -> None:
    parse = reviewed(
        experiences=[an_experience(start_year=2020, start_month=6, end_year=2020, end_month=6)]
    )

    assert parse.experiences[0].end_year == 2020


def test_a_current_job_with_an_end_date_is_no_longer_current() -> None:
    parse = reviewed(experiences=[an_experience(is_current=True, end_year=2022, end_month=4)])

    assert parse.experiences[0].end_year == 2022
    assert parse.experiences[0].is_current is False


def test_a_project_period_is_fitted_the_same_way() -> None:
    parse = reviewed(projects=[a_project(start_year=2024, end_year=1999)])

    assert parse.projects[0].end_year is None


def test_a_headline_longer_than_the_column_is_cut_rather_than_dropped() -> None:
    parse = reviewed(headline="x" * (MAX_LINE_LENGTH + 50))

    assert parse.headline is not None
    assert len(parse.headline) == MAX_LINE_LENGTH


def test_a_summary_is_cut_to_the_longer_limit() -> None:
    parse = reviewed(summary="y" * (MAX_PARAGRAPH_LENGTH + 1))

    assert parse.summary is not None
    assert len(parse.summary) == MAX_PARAGRAPH_LENGTH


@pytest.mark.parametrize("blank", ["", "   ", "\n\t "])
def test_a_blank_field_means_the_cv_did_not_say(blank: str) -> None:
    parse = reviewed(headline=blank, location=blank)

    assert parse.headline is None
    assert parse.location is None


def test_a_link_a_cv_prints_is_kept_in_the_one_form_the_profile_stores() -> None:
    parse = reviewed(
        linkedin_url="  in/amina-haddad ",
        github_url="https://github.com/amina-haddad/ledger",
        portfolio_url="amina-haddad.dev/",
    )

    assert parse.linkedin_url == "https://www.linkedin.com/in/amina-haddad"
    assert parse.github_url == "https://github.com/amina-haddad"
    assert parse.portfolio_url == "https://amina-haddad.dev"


def test_a_link_read_into_the_wrong_field_is_dropped_rather_than_shown_as_an_answer() -> None:
    parse = reviewed(linkedin_url="https://github.com/amina-haddad", github_url="  ")

    assert parse.linkedin_url is None
    assert parse.github_url is None


def test_an_experience_with_no_job_title_is_not_an_experience() -> None:
    parse = reviewed(experiences=[an_experience(job_title="  "), an_experience()])

    assert len(parse.experiences) == 1


def test_an_education_with_no_institution_is_dropped() -> None:
    parse = reviewed(
        educations=[
            ParsedEducation(
                institution="",
                degree="BSc",
                field_of_study=None,
                graduation_year=None,
                description=None,
            )
        ]
    )

    assert parse.educations == []


def test_a_project_with_no_name_is_dropped() -> None:
    parse = reviewed(projects=[a_project(name="")])

    assert parse.projects == []


def test_a_section_longer_than_anyone_could_have_typed_is_cut() -> None:
    parse = reviewed(experiences=[an_experience() for _ in range(MAX_ENTRIES + 10)])

    assert len(parse.experiences) == MAX_ENTRIES
