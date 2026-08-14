"""The record of what this migration has done, in a file beside it.

There is no table for this on purpose — the platform's schema is not changed to accommodate a
one-off script. The consequence is that this file *is* the audit trail: it is what makes a re-run
skip what is finished, and afterwards it is the only record of which Manatal candidate became
which Candidate here. Keep it somewhere safe when the migration is done.

Written after every candidate rather than at the end, so killing the run loses nothing.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Iterator

DEFAULT_PATH: Final = Path("manatal-migration-ledger.json")


class State(StrEnum):
    """Where one candidate got to."""

    IMPORTED = "imported"  # account made, CV stored, parse queued — profile not written yet
    PUBLISHED = "published"  # profile written from the parse, and findable
    NO_RESUME = "no_resume"
    NO_EMAIL = "no_email"
    ALREADY_REGISTERED = "already_registered"
    FAILED = "failed"

    @property
    def is_settled(self) -> bool:
        """Nothing more to do, so a re-run walks past it. `imported` is not settled: its profile
        is still waiting on a parse. Nor is `failed`: retrying is what a re-run is for."""
        return self in {State.PUBLISHED, State.NO_RESUME, State.NO_EMAIL, State.ALREADY_REGISTERED}


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
        """Imported, parse queued, profile not written yet — plus anything that failed mid-way."""
        return [
            entry
            for entry in self._entries.values()
            if entry.state is State.IMPORTED and entry.cv_id is not None
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
