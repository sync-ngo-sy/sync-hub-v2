from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from profile_rows import UNSTATED_YEARS, profile_from

CANDIDATE = UUID("00000000-0000-4000-8000-000000000001")

PYTHON = uuid4()
POSTGRES = uuid4()
TAXONOMY = {"python": PYTHON, "postgresql": POSTGRES}
LANGUAGES = ["en", "ar"]

A_PARSE: dict[str, Any] = {
    "full_name": "Amina Haddad",
    "headline": "Backend engineer, 8 years",
    "summary": "Builds boring payment systems that stay up.",
    "location": "Damascus, Syria",
    "experiences": [
        {
            "job_title": "Senior Backend Engineer",
            "company_name": "Acme Payments",
            "start_year": 2021,
            "start_month": 3,
            "end_year": None,
            "end_month": None,
            "is_current": True,
            "description": "Led the payments ledger rewrite.",
        }
    ],
    "educations": [
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
            "description": None,
        }
    ],
    "skills": [
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": None},
    ],
    "languages": [
        {"code": "ar", "proficiency": "native"},
        {"code": "en", "proficiency": "fluent"},
    ],
    "projects": [
        {
            "name": "Sync",
            "description": "A recruitment platform.",
            "project_url": "https://example.com/sync",
            "repository_url": None,
            "start_year": 2024,
            "start_month": 6,
            "end_year": None,
            "end_month": None,
        }
    ],
    "unmapped_skills": ["Vibe-Driven Development"],
}


def built(**changes: Any) -> Any:
    return profile_from(
        {**A_PARSE, **changes},
        candidate_id=CANDIDATE,
        taxonomy=TAXONOMY,
        languages=LANGUAGES,
    )


def test_every_section_becomes_rows_the_schema_will_take() -> None:
    profile = built()

    assert profile.headline == "Backend engineer, 8 years"
    assert profile.summary == "Builds boring payment systems that stay up."
    assert profile.unmapped_skills == ["Vibe-Driven Development"]
    assert profile.experiences == [
        (
            CANDIDATE,
            0,
            "Senior Backend Engineer",
            "Acme Payments",
            2021,
            3,
            None,
            None,
            True,
            "Led the payments ledger rewrite.",
        )
    ]
    assert profile.educations == [
        (CANDIDATE, 0, "Damascus University", "BSc", "Computer Science", 2017, None)
    ]
    assert profile.languages == [
        (CANDIDATE, 0, "ar", "native"),
        (CANDIDATE, 1, "en", "fluent"),
    ]
    assert profile.projects[0][2] == "Sync"
    assert profile.is_worth_publishing is True


def test_a_skill_with_no_stated_years_is_stored_as_none_of_them() -> None:
    profile = built()

    assert profile.skills == [
        (CANDIDATE, 0, PYTHON, 8.0),
        (CANDIDATE, 1, POSTGRES, UNSTATED_YEARS),
    ]


def test_a_skill_the_taxonomy_does_not_know_is_left_out_rather_than_invented() -> None:
    profile = built(skills=[{"name": "Telepathy", "years_experience": 3.0}])

    assert profile.skills == []


def test_a_language_the_platform_does_not_know_is_left_out() -> None:
    profile = built(languages=[{"code": "zz", "proficiency": "native"}])

    assert profile.languages == []


def test_a_repeated_skill_or_language_is_written_once() -> None:
    """Both tables are keyed on the candidate and the thing, so a repeat would fail the insert."""
    profile = built(
        skills=[{"name": "Python", "years_experience": 8.0}, {"name": "python", "years": 2}],
        languages=[
            {"code": "en", "proficiency": "fluent"},
            {"code": "EN", "proficiency": "native"},
        ],
    )

    assert [row[2] for row in profile.skills] == [PYTHON]
    assert [row[2] for row in profile.languages] == ["en"]


def test_a_current_job_never_carries_an_end_date() -> None:
    """The schema refuses one, and a parse sometimes offers both."""
    profile = built(
        experiences=[
            {
                "job_title": "Engineer",
                "company_name": None,
                "start_year": 2021,
                "start_month": 1,
                "end_year": 2024,
                "end_month": 6,
                "is_current": True,
                "description": None,
            }
        ]
    )

    assert profile.experiences[0][6:9] == (None, None, True)


def test_a_year_outside_what_the_schema_allows_leaves_the_job_undated_so_it_is_dropped() -> None:
    """1719 fails `cexp_start_year_range`, so it cannot be stored — and `start_year` is not
    nullable, so what is left is not a row. The archive still holds it."""
    profile = built(
        experiences=[
            {
                "job_title": "Engineer",
                "company_name": None,
                "start_year": 1719,
                "start_month": 13,
                "end_year": None,
                "end_month": None,
                "is_current": False,
                "description": None,
            }
        ],
        educations=[{"institution": "Somewhere", "graduation_year": 3000}],
    )

    assert profile.experiences == []
    assert profile.educations[0][5] is None


def test_every_experience_row_satisfies_the_two_constraints_on_the_table() -> None:
    """`start_year int not null`, and `cexp_finished_work_has_an_end`. A parse returns jobs that
    meet neither, and one such row aborts the transaction the whole profile is written in."""
    profile = built(
        experiences=[
            {"job_title": "Undated", "start_year": None, "is_current": False},
            {"job_title": "No end", "start_year": 2018, "end_year": None, "is_current": False},
            {"job_title": "Still there", "start_year": 2019, "is_current": True},
            {"job_title": "Finished", "start_year": 2015, "end_year": 2017, "is_current": False},
        ]
    )

    assert [row[2] for row in profile.experiences] == ["Still there", "Finished"]
    for row in profile.experiences:
        start_year, end_year, is_current = row[4], row[6], row[8]
        assert start_year is not None
        assert is_current or end_year is not None


def test_the_kept_jobs_are_numbered_from_zero_after_the_undated_go() -> None:
    """`sort_order` is what the profile is read back in, so a gap would be a missing job."""
    profile = built(
        experiences=[
            {"job_title": "Undated", "is_current": False},
            {"job_title": "Kept", "start_year": 2019, "is_current": True},
        ]
    )

    assert [row[1] for row in profile.experiences] == [0]


def test_a_dated_job_keeps_a_month_the_schema_would_refuse_as_null() -> None:
    """`start_month` is nullable, so a month out of range costs the month, not the job."""
    profile = built(
        experiences=[
            {
                "job_title": "Engineer",
                "start_year": 2019,
                "start_month": 13,
                "end_year": 2021,
                "end_month": 0,
                "is_current": False,
            }
        ]
    )

    assert profile.experiences[0][4:8] == (2019, None, 2021, None)


def test_an_entry_with_no_title_still_names_something() -> None:
    """`job_title` and `institution` are not nullable, and a parse can come back thin."""
    profile = built(
        experiences=[{"company_name": "Acme", "start_year": 2020, "is_current": True}],
        educations=[{"degree": "BSc"}],
        projects=[{"description": "a thing"}],
    )

    assert profile.experiences[0][2] == "Not stated"
    assert profile.educations[0][2] == "Not stated"
    assert profile.projects[0][2] == "Not stated"


def test_empty_text_is_stored_as_nothing_rather_than_an_empty_string() -> None:
    profile = built(summary="   ", headline="")

    assert profile.summary is None
    assert profile.headline is None


def test_a_parse_with_nothing_in_it_is_not_worth_publishing() -> None:
    profile = built(experiences=[], educations=[], skills=[], projects=[], languages=[])

    assert profile.is_worth_publishing is False


def test_a_parse_that_is_all_nulls_does_not_raise() -> None:
    """The one shape a migration meets that a signup never does: a CV the model gave up on."""
    profile = profile_from({}, candidate_id=CANDIDATE, taxonomy=TAXONOMY, languages=LANGUAGES)

    assert profile.is_worth_publishing is False
    assert profile.unmapped_skills == []
