from __future__ import annotations

from typing import Final
from uuid import UUID, uuid4

from platform_writes import FromManatal, matched_skills, role_from_parse

PYTHON: Final = uuid4()
SQL: Final = uuid4()
TAXONOMY: Final[dict[str, UUID]] = {"python": PYTHON, "sql": SQL}
ROLES: Final[dict[str, str]] = {
    "backend engineer": "backend-engineer",
    "logistics officer": "logistics-officer",
}
SOMEBODY: Final = UUID(int=1)


def test_manatal_skills_the_taxonomy_knows_become_canonical_rows() -> None:
    known, unknown = matched_skills(["Python", "SQL"], TAXONOMY)

    assert set(known) == {PYTHON, SQL}
    assert unknown == ()


def test_a_skill_the_taxonomy_has_no_word_for_is_reported_not_dropped() -> None:
    """It still reaches `unmapped_skills`; this half of the answer is what the report names."""
    known, unknown = matched_skills(["Python", "Forklift operation"], TAXONOMY)

    assert known == (PYTHON,)
    assert unknown == ("Forklift operation",)


def test_the_same_skill_twice_is_one_row() -> None:
    """`candidate_skills` is keyed by candidate and skill, so a repeat would break the insert."""
    known, _ = matched_skills(["Python", "python", "  PYTHON  "], TAXONOMY)

    assert known == (PYTHON,)


def test_blank_skills_are_neither_matched_nor_reported() -> None:
    known, unknown = matched_skills(["", "   ", "SQL"], TAXONOMY)

    assert known == (SQL,)
    assert unknown == ()


def test_matched_skills_become_rows_without_inventing_years() -> None:
    """Manatal recorded the skill, not how long — a made-up number would read as measured."""
    rows = FromManatal(matched_skills=(PYTHON, SQL)).skills(SOMEBODY)

    assert rows == [(SOMEBODY, 0, PYTHON, None), (SOMEBODY, 1, SQL, None)]


def test_no_matched_skills_is_no_rows() -> None:
    assert FromManatal().skills(SOMEBODY) == []


def test_the_parses_own_role_is_preferred() -> None:
    """It read the whole CV and was given the taxonomy to answer from."""
    assert role_from_parse({"canonical_role": "backend-engineer"}, ROLES, "Logistics Officer") == (
        "backend-engineer"
    )


def test_a_role_the_taxonomy_no_longer_holds_falls_back_to_the_typed_title() -> None:
    """A parse stored months ago names whatever the list held then."""
    assert role_from_parse({"canonical_role": "cobol-engineer"}, ROLES, "Logistics Officer") == (
        "logistics-officer"
    )


def test_manatals_title_is_used_where_the_parse_proposed_nothing() -> None:
    assert role_from_parse({"canonical_role": None}, ROLES, "Senior Backend Engineer") == (
        "backend-engineer"
    )


def test_no_parse_and_no_title_is_no_role() -> None:
    assert role_from_parse(None, ROLES, None) is None
    assert role_from_parse({}, ROLES, "Barista") is None
