from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from ledger import Entry, Ledger, State
from report import as_html, as_markdown, lines, outcome_of

if TYPE_CHECKING:
    from collections.abc import Sequence


def a_ledger(entries: Sequence[Entry]) -> Ledger:
    return Ledger(
        Path("ledger.json"), {entry.manatal_candidate_id: entry for entry in entries}
    )


def published(
    which: str, *, missing: list[str] | None = None, consent: bool = False, name: str = ""
) -> Entry:
    return Entry(
        manatal_candidate_id=which,
        state=State.PUBLISHED,
        full_name=name or f"Person {which}",
        missing=missing if missing is not None else [],
        consent=consent,
    )


def test_a_complete_consented_profile_is_the_only_kind_that_is_searchable() -> None:
    outcome = outcome_of(
        a_ledger(
            [
                published("1", consent=True),
                published("2", consent=False),
                published("3", missing=["summary"], consent=True),
            ]
        )
    )

    assert outcome.complete == 2
    assert outcome.incomplete == 1
    assert outcome.searchable == 1
    assert outcome.withheld == 1


def test_somebody_not_yet_published_is_not_counted_as_either() -> None:
    """Their profile has not been judged, and counting it either way would be a claim."""
    outcome = outcome_of(
        a_ledger([Entry("1", State.IMPORTED, cv_id="cv"), published("2", consent=True)])
    )

    assert outcome.complete == 1
    assert outcome.incomplete == 0
    assert outcome.total == 2
    assert outcome.moved == 2


def test_what_is_missing_is_counted_across_everybody() -> None:
    outcome = outcome_of(
        a_ledger(
            [
                published("1", missing=["summary", "canonical_role"]),
                published("2", missing=["summary"]),
                published("3", missing=["phone"]),
            ]
        )
    )

    counts = {requirement.value: total for requirement, total in outcome.missing_counts.items()}
    assert counts == {"summary": 2, "canonical_role": 1, "phone": 1}


def test_the_reasons_are_ordered_most_common_first() -> None:
    """What to fix first is the thing keeping the most people out."""
    outcome = outcome_of(
        a_ledger(
            [
                published("1", missing=["canonical_role"]),
                published("2", missing=["canonical_role"]),
                published("3", missing=["phone"]),
            ]
        )
    )

    assert next(iter(outcome.missing_counts)).value == "canonical_role"


def test_a_requirement_this_version_does_not_know_is_ignored_not_crashed_on() -> None:
    """A ledger written by a later version of the script still has to be readable."""
    outcome = outcome_of(a_ledger([published("1", missing=["a_requirement_from_the_future"])]))

    assert outcome.incomplete == 1
    assert outcome.missing_counts == {}


def test_the_terminal_report_speaks_plainly() -> None:
    said = "\n".join(
        lines(outcome_of(a_ledger([published("1", missing=["canonical_role"], consent=True)])))
    )

    assert "no role we could match to our list" in said
    assert "Global search" in said
    assert "canonical_role" not in said


def test_failures_say_who_and_why_and_that_a_re_run_retries_them() -> None:
    outcome = outcome_of(
        a_ledger(
            [Entry("1", State.FAILED, full_name="Bashir Nassar", error="TimeoutError: too slow")]
        )
    )
    said = "\n".join(lines(outcome))

    assert "Bashir Nassar" in said
    assert "too slow" in said
    assert "again retries only these" in said


def test_the_html_report_holds_the_same_numbers() -> None:
    outcome = outcome_of(a_ledger([published("1", consent=True), published("2", consent=False)]))
    page = as_html(outcome, ledger_path=Path("somewhere/ledger.json"))

    assert "2 of 2 people were moved into Sync." in page
    assert "Agreed in Manatal, so searchable" in page
    assert "somewhere" in page


def test_the_html_report_escapes_what_came_from_outside() -> None:
    """Names and error text are Manatal's, not ours."""
    outcome = outcome_of(
        a_ledger([Entry("1", State.FAILED, full_name="<script>alert(1)</script>", error="x & y")])
    )
    page = as_html(outcome, ledger_path=Path("ledger.json"))

    assert "<script>alert(1)</script>" not in page
    assert "&lt;script&gt;" in page
    assert "x &amp; y" in page


def test_the_markdown_summary_carries_the_headline_and_the_tables() -> None:
    """This is what somebody sees on the run's page, so it has to stand alone."""
    outcome = outcome_of(
        a_ledger([published("1", consent=True), published("2", missing=["phone"])])
    )
    page = as_markdown(outcome)

    assert "**2 of 2 people were moved into Sync.**" in page
    assert "Who other companies can find in Global search" in page
    assert "no usable phone number" in page


def test_the_markdown_summary_cannot_be_broken_by_a_name() -> None:
    """A pipe in a name would otherwise split the row and shift every column after it."""
    outcome = outcome_of(
        a_ledger([Entry("1", State.FAILED, full_name="A | B", error="broke\non two lines")])
    )
    page = as_markdown(outcome)

    assert r"A \| B" in page
    assert "broke on two lines" in page
