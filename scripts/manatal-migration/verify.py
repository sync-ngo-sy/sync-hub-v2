"""Checking that what the ledger claims is actually in the platform.

A migration that reports success has told you what it *tried*. This reads the other end: for
every candidate the ledger says arrived, does the account exist, is the file really in the
bucket, does its checksum still match what came out of Manatal, did the CV parse, did the
profile get written, are they findable. Anything that disagrees is named.

Read-only. It fixes nothing — a discrepancy is something to look at, and re-running the
migration is what mends the ones that can be mended.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import TYPE_CHECKING
from uuid import UUID

from ledger import State

if TYPE_CHECKING:
    from collections.abc import Sequence

    import asyncpg

    from ledger import Entry, Ledger
    from supabase_rest import Supabase


@dataclass(frozen=True, slots=True)
class Discrepancy:
    """One thing the ledger claims that the platform does not agree with."""

    manatal_candidate_id: str
    complaint: str

    def __str__(self) -> str:
        return f"  {self.manatal_candidate_id}: {self.complaint}"


@dataclass
class Verdict:
    """What the check found, counted the way somebody signing off would count."""

    checked: int = 0
    sound: int = 0
    discrepancies: list[Discrepancy] = field(default_factory=list)
    #: Candidates Manatal holds that the ledger has never seen. Non-empty means the migration
    #: has not finished walking the account, whatever the last run reported.
    missing_from_ledger: list[str] = field(default_factory=list)

    @property
    def is_sound(self) -> bool:
        return not self.discrepancies and not self.missing_from_ledger

    def wrong(self, entry: Entry, complaint: str) -> None:
        self.discrepancies.append(Discrepancy(entry.manatal_candidate_id, complaint))

    def as_lines(self) -> list[str]:
        lines = [f"Checked {self.checked} migrated candidates against the platform."]
        if self.missing_from_ledger:
            shown = ", ".join(self.missing_from_ledger[:10])
            hidden = len(self.missing_from_ledger) - 10
            more = f" (+{hidden} more)" if hidden > 0 else ""
            lines += [
                "",
                f"{len(self.missing_from_ledger)} candidates in Manatal are not in the ledger:",
                f"  {shown}{more}",
                "Run the migration again — it has not walked the whole account yet.",
            ]
        if self.discrepancies:
            lines += ["", f"{len(self.discrepancies)} disagreed with the ledger:"]
            lines += [str(found) for found in self.discrepancies[:50]]
            if len(self.discrepancies) > 50:
                lines.append(f"  … and {len(self.discrepancies) - 50} more")
        if self.is_sound:
            lines.append("Everything the ledger claims is there, and the files still match.")
        return lines


class Verification:
    """Reads the platform back and compares it with the ledger, one candidate at a time."""

    def __init__(self, pool: asyncpg.Pool, supabase: Supabase, ledger: Ledger) -> None:
        self._pool = pool
        self._supabase = supabase
        self._ledger = ledger

    async def run(self, *, in_manatal: Sequence[str] = ()) -> Verdict:
        verdict = Verdict()
        for entry in self._ledger:
            if entry.state not in {State.IMPORTED, State.PUBLISHED}:
                continue
            verdict.checked += 1
            before = len(verdict.discrepancies)
            await self._check(entry, verdict)
            if len(verdict.discrepancies) == before:
                verdict.sound += 1

        verdict.missing_from_ledger = [
            external_id for external_id in in_manatal if self._ledger.of(external_id) is None
        ]
        return verdict

    async def _check(self, entry: Entry, verdict: Verdict) -> None:
        if entry.candidate_id is None or entry.cv_id is None:
            verdict.wrong(entry, "the ledger says imported but names no candidate or CV")
            return
        candidate_id, cv_id = UUID(entry.candidate_id), UUID(entry.cv_id)

        row = await self._pool.fetchrow(
            """
            select c.id,
                   c.is_imported_from_manatal,
                   c.is_searchable,
                   c.current_cv_id,
                   p.full_name,
                   u.email,
                   v.storage_path,
                   v.file_hash,
                   v.parsing_status::text as parsing_status,
                   (select count(*) from talent_pool_members m where m.candidate_id = c.id)
                       as pooled,
                   (select count(*) from candidate_experiences e where e.candidate_id = c.id)
                     + (select count(*) from candidate_educations d where d.candidate_id = c.id)
                     + (select count(*) from candidate_skills s where s.candidate_id = c.id)
                       as profile_rows
              from candidates c
              join profiles p on p.id = c.id
              join auth.users u on u.id = c.id
              left join cvs v on v.id = $2 and v.candidate_id = c.id
             where c.id = $1
            """,
            candidate_id,
            cv_id,
        )
        if row is None:
            verdict.wrong(entry, "no Candidate with that id — the account or its rows are gone")
            return

        if not row["is_imported_from_manatal"]:
            verdict.wrong(entry, "not flagged as imported from Manatal")
        if entry.email and row["email"] != entry.email:
            verdict.wrong(entry, f"the account's address is {row['email']}, not {entry.email}")
        if not row["pooled"]:
            verdict.wrong(entry, "not in the importing Tenant's talent pool")
        if row["storage_path"] is None:
            verdict.wrong(entry, "the ledger names a CV this Candidate does not own")
            return

        await self._check_file(entry, row["storage_path"], row["file_hash"], verdict)
        self._check_parse(entry, row, verdict)

    async def _check_file(
        self, entry: Entry, storage_path: str, file_hash: str, verdict: Verdict
    ) -> None:
        """The one check nothing else does: that the bytes in the bucket are the bytes Manatal
        served. A row pointing at a missing or altered object would look fine everywhere else."""
        if entry.file_hash and file_hash != entry.file_hash:
            verdict.wrong(entry, "the cvs row's checksum is not the one the ledger recorded")
        content = await self._supabase.read_cv(storage_path)
        if content is None:
            verdict.wrong(entry, f"no file in the bucket at {storage_path}")
            return
        stored = hashlib.sha256(content).hexdigest()
        if stored != file_hash:
            verdict.wrong(entry, "the stored file does not match its own checksum")

    def _check_parse(self, entry: Entry, row: asyncpg.Record, verdict: Verdict) -> None:
        parsing = row["parsing_status"]
        if entry.state is State.IMPORTED:
            if parsing == "failed":
                verdict.wrong(entry, "the CV parse failed, so no profile can be written")
            return

        # Published: the parse ran and the profile was written. Whether they are *findable* is a
        # separate question with two answers of its own — see below.
        if parsing != "ready":
            verdict.wrong(entry, f"published but the CV is {parsing}, not ready")
        if not row["profile_rows"]:
            verdict.wrong(entry, "published but the profile has no experience, education or skills")
        if row["current_cv_id"] is None:
            verdict.wrong(entry, "published but no current CV, so Global search excludes them")
        self._check_searchable(entry, row, verdict)

    def _check_searchable(self, entry: Entry, row: asyncpg.Record, verdict: Verdict) -> None:
        """Findable is not a claim about everybody — only about those who agreed and are complete.

        So the disagreements worth reporting are the two the migration would be wrong about: on
        without consent, which shows somebody who did not agree, and off despite consent and a
        complete profile, which withholds somebody who did.
        """
        searchable = bool(row["is_searchable"])
        if searchable and not entry.consent:
            verdict.wrong(entry, "searchable, but Manatal recorded no consent from them")
        if not searchable and entry.consent and entry.missing == []:
            verdict.wrong(entry, "consented and complete, but not searchable")
