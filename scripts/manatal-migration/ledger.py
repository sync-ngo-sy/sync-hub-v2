"""The record of what this migration has done, in a file beside it.

There is no table for this on purpose — the platform's schema is not changed to accommodate a
one-off script. The consequence is that this file *is* the audit trail: it is what makes a re-run
skip what is finished, and afterwards it is the only record of which Manatal candidate became
which Candidate here. Keep it somewhere safe when the migration is done.

Written after every candidate rather than at the end, so killing the run loses nothing.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Iterator

#: Beside this script, not beside whoever ran it. The `.gitignore` that keeps 5,000 names and
#: email addresses out of the repository lives in this folder, so anchoring the default here is
#: what makes that protection hold however the script was invoked.
DEFAULT_PATH: Final = Path(__file__).resolve().parent / "manatal-migration-ledger.json"


class State(StrEnum):
    """Where one candidate got to."""

    IMPORTED = "imported"  # account made, CV stored, parse queued — profile not written yet
    PUBLISHED = "published"  # profile written from the parse
    #: Settled, and nothing written on purpose: somebody had already filled the profile in, or the
    #: parse found nothing worth publishing. Distinct from `published` because the verification
    #: pass asks a published profile to have content and a current CV, and would report three
    #: disagreements per candidate for these — failing a sign-off on a correct migration.
    LEFT_ALONE = "left_alone"
    NO_RESUME = "no_resume"
    NO_EMAIL = "no_email"
    ALREADY_REGISTERED = "already_registered"
    FAILED = "failed"

    @property
    def is_settled(self) -> bool:
        """Nothing more to do, so a re-run walks past it. `imported` is not settled: its profile
        is still waiting on a parse. Nor is `failed`: retrying is what a re-run is for."""
        return self in {
            State.PUBLISHED,
            State.LEFT_ALONE,
            State.NO_RESUME,
            State.NO_EMAIL,
            State.ALREADY_REGISTERED,
        }


@dataclass
class Entry:
    manatal_candidate_id: str
    state: State
    full_name: str = ""
    email: str = ""
    candidate_id: str | None = None
    cv_id: str | None = None
    file_hash: str | None = None
    attempts: int = 0
    error: str | None = None
    #: The two structured facts Manatal keeps as fields. Kept here so publishing can fall back
    #: to them without asking an ATS that may be switched off by then.
    position: str | None = None
    company: str | None = None
    degree: str | None = None
    university: str | None = None
    graduation_year: int | None = None
    english: str | None = None
    #: Manatal's own skill list, kept so publishing can match it to the taxonomy without Manatal.
    skills: list[str] = field(default_factory=list)
    #: Whether they agreed to be found by Tenants they never applied to. Read at import and kept,
    #: because it decides `is_searchable` in the publish pass — which may run days later.
    consent: bool = False
    #: Which of the ten requirements the published profile still lacks, for the report. Empty
    #: means complete; `None` means it has not been published yet.
    missing: list[str] | None = None


class Ledger:
    """Every candidate this migration has looked at, keyed by their Manatal id."""

    def __init__(self, path: Path, entries: dict[str, Entry]) -> None:
        self._path = path
        self._entries = entries

    @classmethod
    def at(cls, path: Path) -> Ledger:
        if not path.exists():
            return cls(path, {})
        written = json.loads(path.read_text(encoding="utf-8"))
        entries = {
            key: Entry(**{**value, "state": State(value["state"])})
            for key, value in written.get("entries", {}).items()
        }
        return cls(path, entries)

    @property
    def path(self) -> Path:
        return self._path

    def __len__(self) -> int:
        return len(self._entries)

    def __iter__(self) -> Iterator[Entry]:
        return iter(self._entries.values())

    def of(self, manatal_candidate_id: str) -> Entry | None:
        return self._entries.get(manatal_candidate_id)

    def is_settled(self, manatal_candidate_id: str) -> bool:
        entry = self._entries.get(manatal_candidate_id)
        return entry is not None and entry.state.is_settled

    def awaiting_publication(self) -> list[Entry]:
        """Imported, parse queued, profile not written yet — plus anything that failed mid-way.

        Failed entries belong here as long as they got as far as a CV. A publish that the database
        refused leaves one, and without this only a full run would ever pick it up again — so
        `--publish-only`, the pass somebody runs repeatedly while the worker catches up, would
        walk past the very candidates it exists to finish.
        """
        return [
            entry
            for entry in self._entries.values()
            if entry.state in {State.IMPORTED, State.FAILED} and entry.cv_id is not None
        ]

    def record(self, entry: Entry) -> None:
        previous = self._entries.get(entry.manatal_candidate_id)
        entry.attempts = (previous.attempts if previous else 0) + 1
        self._entries[entry.manatal_candidate_id] = entry
        self.save()

    def save(self) -> None:
        self._path.write_text(
            json.dumps(
                {"entries": {key: asdict(value) for key, value in self._entries.items()}},
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )

    def tally(self) -> dict[State, int]:
        counted: dict[State, int] = {}
        for entry in self._entries.values():
            counted[entry.state] = counted.get(entry.state, 0) + 1
        return counted
