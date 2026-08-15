from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from sync_core.completeness import (
    ProfileFacts,
    Requirement,
    completion_percent,
    missing_requirements,
)

SHARED = Path(__file__).resolve().parents[4] / "fixtures" / "profile-completeness.json"

_fixture: dict[str, Any] = json.loads(SHARED.read_text())
CASES: list[dict[str, Any]] = _fixture["cases"]


def _case_id(case: dict[str, Any]) -> str:
    name: str = case["name"]
    return name


def test_the_requirements_are_the_ones_the_shared_fixture_names() -> None:
    assert [requirement.value for requirement in Requirement] == _fixture["requirements"]


@pytest.mark.parametrize("case", CASES, ids=_case_id)
def test_a_shared_case_reports_the_requirements_it_says_are_missing(case: dict[str, Any]) -> None:
    missing = missing_requirements(ProfileFacts(**case["facts"]))

    assert [requirement.value for requirement in missing] == case["missing"]


@pytest.mark.parametrize("case", CASES, ids=_case_id)
def test_a_shared_case_is_the_percent_it_says_it_is(case: dict[str, Any]) -> None:
    assert (
        completion_percent(missing_requirements(ProfileFacts(**case["facts"]))) == case["percent"]
    )


def test_a_profile_missing_nothing_is_complete() -> None:
    whole = ProfileFacts(
        has_a_read_cv=True,
        full_name="Amina Haddad",
        phone="+963115550134",
        phone_country="SY",
        headline="Backend engineer, 8 years",
        location_key="sy-damascus",
        canonical_role_key="backend-engineer",
        summary="Builds boring systems that stay up.",
        experiences=1,
        educations=1,
        skills=1,
        languages=1,
    )

    assert missing_requirements(whole) == ()
    assert completion_percent(()) == 100
