from __future__ import annotations

from typing import Any

from inventory import Home, as_mapping, census_of
from manatal import _candidate


def read(*records: dict[str, Any]) -> Any:
    """The census of these Manatal records, read exactly as the migration reads them."""
    return census_of([_candidate(record) for record in records])


def test_a_field_the_migration_writes_is_reported_as_migrated() -> None:
    census = read({"id": 1, "full_name": "Amina", "email": "a@b.c", "phone_number": "+963"})

    assert census.fields["phone_number"].mapped.home is Home.MIGRATED
    assert census.fields["phone_number"].mapped.lands_in == "profiles.phone"
    assert census.fields["email"].mapped.home is Home.MIGRATED


def test_a_field_nobody_has_ruled_on_is_surfaced_as_a_decision() -> None:
    """The whole point: an unknown field is a decision somebody owes, not a silent drop."""
    census = read({"id": 1, "linkedin_url": "https://example.com/in/amina"})

    assert census.fields["linkedin_url"].mapped.home is Home.DECIDE
    assert [found.key for found in census.undecided] == ["linkedin_url"]


def test_an_unknown_field_nobody_has_data_in_is_not_a_decision() -> None:
    """Empty is not worth anybody's time, and a report full of them hides the ones that are."""
    census = read({"id": 1, "custom_field_7": None}, {"id": 2, "custom_field_7": ""})

    assert census.fields["custom_field_7"].mapped.home is Home.DECIDE
    assert census.undecided == []


def test_fill_rates_count_what_is_actually_there() -> None:
    census = read(
        {"id": 1, "phone_number": "+963 11"},
        {"id": 2, "phone_number": ""},
        {"id": 3},
        {"id": 4, "phone_number": "+963 22"},
    )

    phones = census.fields["phone_number"]
    assert census.counted == 4
    assert phones.present == 3
    assert phones.filled == 2
    assert phones.fill_rate(census.counted) == 0.5


def test_manatals_own_structured_sections_are_archived_not_written() -> None:
    """Both sources writing candidate_experiences is how a profile gets everything twice."""
    census = read({"id": 1, "experiences": [{"title": "Engineer"}], "educations": []})

    assert census.fields["experiences"].mapped.home is Home.ARCHIVED
    assert census.fields["educations"].mapped.home is Home.ARCHIVED


def test_manatals_own_workflow_is_reported_as_having_no_home() -> None:
    census = read({"id": 1, "stage": "Interview", "owner": "rana@example.com"})

    assert census.fields["stage"].mapped.home is Home.IGNORED
    assert census.fields["owner"].mapped.home is Home.IGNORED


def test_the_report_names_every_undecided_field_carrying_data() -> None:
    census = read({"id": 1, "referred_by": "A colleague", "salary_expectation": "1200"})

    report = "\n".join(census.as_lines())

    assert "referred_by" in report
    assert "salary_expectation" in report
    assert "Undecided fields carrying data" in report


def test_a_fully_understood_account_says_so() -> None:
    census = read({"id": 1, "full_name": "Amina", "email": "a@b.c"})

    assert "Every field carrying data has a decision against it." in "\n".join(census.as_lines())


def test_an_example_value_is_shown_but_truncated() -> None:
    census = read({"id": 1, "summary": "x" * 500})

    example = census.fields["summary"].example
    assert example.endswith("…")
    assert len(example) < 100


def test_the_archive_record_keeps_the_whole_manatal_object() -> None:
    """After Manatal is switched off, an unarchived field is gone for good."""
    record = {
        "id": 42,
        "full_name": "Amina Haddad",
        "email": "amina@example.com",
        "phone_number": "+963 11 555",
        "referred_by": "A colleague",
        "stage": "Interview",
    }

    kept = as_mapping(_candidate(record))

    assert kept["manatal_candidate_id"] == "42"
    assert kept["manatal_record"] == record
    assert kept["read_as"]["phone"] == "+963 11 555"
