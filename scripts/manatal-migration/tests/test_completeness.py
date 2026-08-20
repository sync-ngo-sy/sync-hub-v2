from __future__ import annotations

import re
from pathlib import Path
from typing import Final

import pytest

from completeness import (
    IN_PLAIN_WORDS,
    ProfileFacts,
    Requirement,
    completion_percent,
    missing_requirements,
    why_not_complete,
)

EVERYTHING: Final = ProfileFacts(
    has_a_read_cv=True,
    full_name="Rana Haddad",
    phone="+963932345678",
    phone_country="SY",
    headline="Backend engineer",
    summary="Eight years on payments systems.",
    location_key="sy-damascus",
    canonical_role_key="backend-engineer",
    educations=1,
    skills=3,
    languages=2,
)

#: The platform's own copy of this rule. Mirrored, not imported, so it can drift — this is what
#: notices.
PLATFORM: Final = (
    Path(__file__).resolve().parents[3]
    / "services"
    / "api"
    / "packages"
    / "core"
    / "src"
    / "sync_core"
    / "completeness.py"
)


def test_a_profile_holding_all_ten_is_complete() -> None:
    assert missing_requirements(EVERYTHING) == ()
    assert completion_percent(()) == 100
    assert why_not_complete(()) == "complete"


@pytest.mark.parametrize(
    ("absent", "expected"),
    [
        ({"has_a_read_cv": False}, Requirement.CV),
        ({"full_name": None}, Requirement.FULL_NAME),
        ({"headline": "   "}, Requirement.HEADLINE),
        ({"location_key": None}, Requirement.LOCATION),
        ({"canonical_role_key": None}, Requirement.CANONICAL_ROLE),
        ({"summary": ""}, Requirement.SUMMARY),
        ({"educations": 0}, Requirement.EDUCATION),
        ({"skills": 0}, Requirement.SKILL),
        ({"languages": 0}, Requirement.LANGUAGE),
    ],
)
def test_one_fact_absent_is_one_requirement_missing(
    absent: dict[str, object], expected: Requirement
) -> None:
    from dataclasses import replace

    assert missing_requirements(replace(EVERYTHING, **absent)) == (expected,)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "absent", [{"phone": None}, {"phone_country": None}, {"phone": None, "phone_country": None}]
)
def test_a_number_without_its_country_is_no_number(absent: dict[str, object]) -> None:
    """`profiles` refuses one column without the other, so half a phone is not a phone."""
    from dataclasses import replace

    assert missing_requirements(replace(EVERYTHING, **absent)) == (Requirement.PHONE,)  # type: ignore[arg-type]


def test_an_empty_profile_is_missing_all_ten() -> None:
    missing = missing_requirements(ProfileFacts())
    assert len(missing) == len(Requirement)
    assert completion_percent(missing) == 0


def test_every_requirement_can_be_explained_to_an_operator() -> None:
    """The report names what is missing, so nothing may be missing from the report."""
    assert set(IN_PLAIN_WORDS) == set(Requirement)
    assert all(words and not words.endswith(".") for words in IN_PLAIN_WORDS.values())


def test_the_reason_lists_each_missing_requirement() -> None:
    from dataclasses import replace

    missing = missing_requirements(replace(EVERYTHING, canonical_role_key=None, skills=0))
    reason = why_not_complete(missing)
    assert "role" in reason
    assert "skill" in reason


@pytest.mark.skipif(not PLATFORM.exists(), reason="running outside the repository")
def test_the_rule_still_matches_the_platforms_own() -> None:
    """A requirement added or renamed upstream would silently stop being checked here."""
    upstream = PLATFORM.read_text(encoding="utf-8")
    theirs = set(re.findall(r'^    [A-Z_]+ = "([a-z_]+)"$', upstream, re.MULTILINE))
    assert theirs == {requirement.value for requirement in Requirement}
