from __future__ import annotations

from typing import TYPE_CHECKING

from ledger import Entry, Ledger, State

if TYPE_CHECKING:
    from pathlib import Path


def an_entry(external_id: str = "42", state: State = State.IMPORTED, **changes: object) -> Entry:
    return Entry(
        manatal_candidate_id=external_id,
        state=state,
        full_name="Amina Haddad",
        email="amina@example.com",
        **changes,  # type: ignore[arg-type]
    )


def test_a_settled_candidate_is_walked_past_on_the_next_run(tmp_path: Path) -> None:
    ledger = Ledger.at(tmp_path / "ledger.json")

    ledger.record(an_entry("1", State.PUBLISHED))
    ledger.record(an_entry("2", State.NO_EMAIL))
    ledger.record(an_entry("3", State.NO_RESUME))
    ledger.record(an_entry("4", State.ALREADY_REGISTERED))

    assert all(ledger.is_settled(str(number)) for number in range(1, 5))


def test_an_import_awaiting_its_parse_is_not_settled(tmp_path: Path) -> None:
    """Its profile has not been written yet, so the next run has work to do for it."""
    ledger = Ledger.at(tmp_path / "ledger.json")

    ledger.record(an_entry("42", State.IMPORTED, candidate_id="c", cv_id="v"))

    assert ledger.is_settled("42") is False
    assert [entry.manatal_candidate_id for entry in ledger.awaiting_publication()] == ["42"]


def test_a_failure_is_retried_rather_than_walked_past(tmp_path: Path) -> None:
    ledger = Ledger.at(tmp_path / "ledger.json")

    ledger.record(an_entry("42", State.FAILED, error="boom"))

    assert ledger.is_settled("42") is False


def test_an_unknown_candidate_is_not_settled(tmp_path: Path) -> None:
    assert Ledger.at(tmp_path / "ledger.json").is_settled("never-seen") is False


def test_it_survives_the_run_being_killed(tmp_path: Path) -> None:
    """Written after every candidate, so what a dead run did is still known."""
    path = tmp_path / "ledger.json"
    Ledger.at(path).record(an_entry("42", State.IMPORTED, candidate_id="c", cv_id="v"))

    reopened = Ledger.at(path)

    assert len(reopened) == 1
    entry = reopened.of("42")
    assert entry is not None
    assert entry.state is State.IMPORTED
    assert entry.cv_id == "v"


def test_attempts_count_up_across_runs(tmp_path: Path) -> None:
    path = tmp_path / "ledger.json"
    ledger = Ledger.at(path)

    ledger.record(an_entry("42", State.FAILED))
    ledger.record(an_entry("42", State.FAILED))
    ledger.record(an_entry("42", State.PUBLISHED))

    entry = Ledger.at(path).of("42")
    assert entry is not None
    assert entry.attempts == 3
    assert entry.state is State.PUBLISHED


def test_the_tally_is_what_the_report_prints(tmp_path: Path) -> None:
    ledger = Ledger.at(tmp_path / "ledger.json")
    ledger.record(an_entry("1", State.PUBLISHED))
    ledger.record(an_entry("2", State.PUBLISHED))
    ledger.record(an_entry("3", State.NO_EMAIL))

    assert ledger.tally() == {State.PUBLISHED: 2, State.NO_EMAIL: 1}
