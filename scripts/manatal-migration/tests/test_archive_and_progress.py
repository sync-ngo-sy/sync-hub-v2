from __future__ import annotations

import json
from typing import TYPE_CHECKING

from archive import Archive
from manatal import Candidate
from progress import Progress, duration

if TYPE_CHECKING:
    from pathlib import Path


def a_candidate(external_id: str = "42", **raw: object) -> Candidate:
    return Candidate(
        external_id=external_id,
        full_name="Amina Haddad",
        email="amina@example.com",
        raw={"id": external_id, "full_name": "Amina Haddad", **raw},
    )


def test_every_record_is_written_down(tmp_path: Path) -> None:
    archive = Archive(tmp_path / "records.jsonl")

    kept = archive.keep([a_candidate("1"), a_candidate("2", referred_by="A colleague")])

    assert kept == 2
    written = [json.loads(line) for line in archive.path.read_text(encoding="utf-8").splitlines()]
    assert [record["manatal_candidate_id"] for record in written] == ["1", "2"]
    assert written[1]["manatal_record"]["referred_by"] == "A colleague"


def test_a_second_run_does_not_write_anybody_twice(tmp_path: Path) -> None:
    path = tmp_path / "records.jsonl"
    Archive(path).keep([a_candidate("1"), a_candidate("2")])

    added = Archive(path).keep([a_candidate("1"), a_candidate("2"), a_candidate("3")])

    assert added == 1
    assert len(Archive(path)) == 3


def test_a_run_killed_mid_line_still_leaves_a_usable_archive(tmp_path: Path) -> None:
    """Appended as it goes, so a dead run keeps what it had. The half-written line is skipped."""
    path = tmp_path / "records.jsonl"
    Archive(path).keep([a_candidate("1")])
    with path.open("a", encoding="utf-8") as sink:
        sink.write('{"manatal_candidate_id": "2", "manatal_rec')

    reopened = Archive(path)

    assert len(reopened) == 1
    assert reopened.keep([a_candidate("2")]) == 1


class Clock:
    """A clock the test moves by hand, so the arithmetic is checkable."""

    def __init__(self) -> None:
        self.at = 0.0

    def __call__(self) -> float:
        return self.at


def test_progress_counts_and_estimates_from_what_has_finished() -> None:
    clock = Clock()
    walking = Progress(total=100, _now=clock)
    clock.at = 10.0
    walking.advance(20)

    assert walking.percent == 0.2
    assert walking.per_second == 2.0
    assert walking.eta_seconds == 40.0
    assert "40s left" in walking.line()


def test_progress_says_nothing_it_cannot_yet_know() -> None:
    """Two samples extrapolate to nonsense, so the estimate waits until it means something."""
    clock = Clock()
    walking = Progress(total=1000, _now=clock)
    clock.at = 1.0
    walking.advance(2)

    assert walking.eta_seconds is None
    assert "left" not in walking.line()


def test_progress_never_runs_past_the_total() -> None:
    walking = Progress(total=3)
    walking.advance(5)

    assert walking.done == 3
    assert walking.remaining == 0
    assert walking.eta_seconds is None


def test_durations_read_the_way_somebody_waiting_would_say_them() -> None:
    assert duration(45) == "45s"
    assert duration(90) == "2m"
    assert duration(3600) == "1h"
    assert duration(5400) == "1h 30m"
