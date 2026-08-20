"""Every Manatal record, kept verbatim beside the migration.

The reason this exists: Manatal is being switched off. A field this platform has no home for is
not merely unmigrated, it is about to stop existing anywhere. Writing each record down as it is
read costs nothing and turns "we lost it" into "it is in the archive, and a backfill can read it
without an ATS to ask".

One JSON object per line, appended as candidates are read, so a killed run keeps everything it
had already fetched.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Final

from inventory import as_mapping

if TYPE_CHECKING:
    from collections.abc import Iterable

    from manatal import Candidate

#: Beside this script, for the reason the ledger is: this is the most sensitive file the run
#: produces, and the `.gitignore` covering it is in this folder.
DEFAULT_PATH: Final = Path(__file__).resolve().parent / "manatal-candidates.jsonl"


class Archive:
    """The raw record of every candidate this migration has read."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._written = self._already_written()

    @property
    def path(self) -> Path:
        return self._path

    def __len__(self) -> int:
        return len(self._written)

    def _already_written(self) -> set[str]:
        """Which candidates are in the archive from an earlier run, so a re-run does not double
        them up. A malformed line is skipped rather than fatal — an archive is worth having even
        when part of it was written by a run that died mid-line."""
        if not self._path.exists():
            return set()
        written: set[str] = set()
        for line in self._path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                written.add(str(json.loads(line)["manatal_candidate_id"]))
            except (ValueError, KeyError, TypeError):
                continue
        return written

    def keep(self, candidates: Iterable[Candidate]) -> int:
        """Write down everyone not already written. Returns how many were added."""
        fresh = [
            candidate
            for candidate in candidates
            if candidate.external_id and candidate.external_id not in self._written
        ]
        if not fresh:
            return 0
        with self._path.open("a", encoding="utf-8") as sink:
            for candidate in fresh:
                sink.write(json.dumps(as_mapping(candidate), ensure_ascii=False) + "\n")
                self._written.add(candidate.external_id)
        return len(fresh)
