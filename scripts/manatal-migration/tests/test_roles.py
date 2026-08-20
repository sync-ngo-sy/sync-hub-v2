from __future__ import annotations

from typing import Final

import pytest

from roles import role_key_of

TAXONOMY: Final[dict[str, str]] = {
    "backend engineer": "backend-engineer",
    "frontend engineer": "frontend-engineer",
    "engineer": "engineer",
    "data analyst": "data-analyst",
    "logistics officer": "logistics-officer",
    "project manager": "project-manager",
}


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        ("Backend Engineer", "backend-engineer"),
        ("backend engineer", "backend-engineer"),
        ("  Data Analyst  ", "data-analyst"),
    ],
)
def test_a_title_that_names_a_role_exactly(typed: str, expected: str) -> None:
    assert role_key_of(typed, TAXONOMY) == expected


@pytest.mark.parametrize(
    "typed",
    [
        "Senior Backend Engineer",
        "Junior Backend Engineer",
        "Backend Engineer II",
        "Lead Backend Engineer",
    ],
)
def test_seniority_is_not_part_of_the_role(typed: str) -> None:
    """How long somebody has worked is held separately, so it cannot change what they are."""
    assert role_key_of(typed, TAXONOMY) == "backend-engineer"


def test_the_more_specific_role_wins() -> None:
    """A title holding both roles answers the narrower one, or the match loses what was known."""
    assert role_key_of("Senior Backend Engineer", TAXONOMY) == "backend-engineer"


def test_a_title_naming_only_the_general_role_gets_it() -> None:
    assert role_key_of("Engineer", TAXONOMY) == "engineer"


@pytest.mark.parametrize(
    "typed",
    [None, "", "   ", "Chief of Staff", "Barista", "Head of Everything", "Senior", "N/A"],
)
def test_nothing_certain_is_no_role_rather_than_a_wrong_one(typed: str | None) -> None:
    assert role_key_of(typed, TAXONOMY) is None


def test_a_title_with_extra_words_around_a_role_still_matches() -> None:
    assert role_key_of("Logistics Officer (Damascus)", TAXONOMY) == "logistics-officer"


def test_a_title_holding_only_part_of_a_role_name_does_not_match() -> None:
    """"Analyst" alone is not "Data Analyst" — the missing word is the one that says which kind."""
    assert role_key_of("Analyst", TAXONOMY) is None
