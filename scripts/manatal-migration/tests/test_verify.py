"""The verification pass, on the parts that do not need a database.

Its findings decide whether a migration is signed off, so the counting has to stay right however
the checks interleave — and it has to be quick enough that somebody actually runs it.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Final

from ledger import Entry, Ledger, State
from verify import Verdict, Verification

if TYPE_CHECKING:
    from pathlib import Path

SOMEBODY: Final = "00000000-0000-4000-8000-000000000001"


def a_ledger(tmp_path: Path, how_many: int, state: State = State.PUBLISHED) -> Ledger:
    entries = {
        str(number): Entry(
            manatal_candidate_id=str(number),
            state=state,
            full_name=f"Person {number}",
            email=f"p{number}@example.com",
            candidate_id=SOMEBODY,
            cv_id=SOMEBODY,
        )
        for number in range(how_many)
    }
    return Ledger(tmp_path / "ledger.json", entries)


class Watching(Verification):
    """Records how many checks were in flight at once, and never touches a database."""

    def __init__(self, ledger: Ledger, *, concurrency: int) -> None:
        super().__init__(None, None, ledger, concurrency=concurrency)  # type: ignore[arg-type]
        self.at_once = 0
        self.most_at_once = 0

    async def _check(self, entry: Entry, verdict: Verdict) -> None:
        self.at_once += 1
        self.most_at_once = max(self.most_at_once, self.at_once)
        await asyncio.sleep(0)
        if entry.manatal_candidate_id == "3":
            verdict.wrong(entry, "made up, for the counting")
        self.at_once -= 1


async def test_the_checks_run_several_at_a_time(tmp_path: Path) -> None:
    """One at a time over 5,000 CV downloads is the pass people skip."""
    watching = Watching(a_ledger(tmp_path, 20), concurrency=4)

    await watching.run()

    assert watching.most_at_once > 1
    assert watching.most_at_once <= 4


async def test_the_fan_out_is_respected(tmp_path: Path) -> None:
    watching = Watching(a_ledger(tmp_path, 20), concurrency=1)

    await watching.run()

    assert watching.most_at_once == 1


async def test_every_candidate_is_counted_once_however_they_interleave(tmp_path: Path) -> None:
    watching = Watching(a_ledger(tmp_path, 20), concurrency=8)

    verdict = await watching.run()

    assert verdict.checked == 20
    assert verdict.sound == 19
    assert len(verdict.discrepancies) == 1


async def test_a_findings_owner_is_not_confused_by_a_concurrent_one(tmp_path: Path) -> None:
    """Counting `sound` off a shared list would credit or blame the wrong candidate."""
    watching = Watching(a_ledger(tmp_path, 20), concurrency=8)

    verdict = await watching.run()

    assert verdict.discrepancies[0].manatal_candidate_id == "3"


async def test_states_the_migration_settled_without_writing_are_still_checked(
    tmp_path: Path,
) -> None:
    watching = Watching(a_ledger(tmp_path, 5, State.LEFT_ALONE), concurrency=4)

    assert (await watching.run()).checked == 5


async def test_states_with_nothing_to_check_are_skipped(tmp_path: Path) -> None:
    watching = Watching(a_ledger(tmp_path, 5, State.NO_EMAIL), concurrency=4)

    assert (await watching.run()).checked == 0


async def test_candidates_manatal_holds_that_the_ledger_never_saw_are_named(
    tmp_path: Path,
) -> None:
    watching = Watching(a_ledger(tmp_path, 2), concurrency=4)

    verdict = await watching.run(in_manatal=["0", "1", "99"])

    assert verdict.missing_from_ledger == ["99"]
