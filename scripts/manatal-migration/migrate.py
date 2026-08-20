"""Bring a Manatal account's candidates and their CVs into Sync, once.

    uv run migrate.py

Run it, let the platform's worker parse what it stored, then run it again to publish the profiles.
See README.md. It changes no schema, adds no endpoint, and leaves nothing running.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import io
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final
from uuid import UUID

import platform_writes as writes
from archive import DEFAULT_PATH as ARCHIVE_PATH
from archive import Archive
from inventory import census_of
from ledger import DEFAULT_PATH, Entry, Ledger, State
from links import linkedin_address
from manatal import (
    CandidateGoneError,
    Manatal,
    ManatalError,
    ResumeMissingError,
)
from profile_rows import proficiency_of, profile_from
from progress import Progress
from supabase_rest import AddressTakenError, Supabase
from verify import Verification

if TYPE_CHECKING:
    import asyncpg

    from manatal import Candidate

DEFAULT_BASE_URL: Final = "https://api.manatal.com/open/v3"

#: Stands in for the importing Recruiter when the run never imports anything — `--inventory`
#: reads Manatal and stops, so it has nobody to attribute anything to.
NOBODY: Final = UUID(int=0)


@dataclass(frozen=True, slots=True)
class Options:
    database_url: str
    supabase_url: str
    service_role_key: str
    manatal_token: str
    recruiter_id: UUID
    base_url: str
    page_size: int
    limit: int
    concurrency: int
    timeout_seconds: float
    ledger_path: Path
    archive_path: Path
    sample: int
    archiving: bool
    publish_only: bool
    inventory_only: bool
    verify_only: bool


def options() -> Options:
    parsed = argparse.ArgumentParser(description=__doc__)
    parsed.add_argument(
        "--publish-only",
        action="store_true",
        help="Skip Manatal entirely and only write profiles for CVs the worker has now parsed.",
    )
    parsed.add_argument(
        "--inventory",
        action="store_true",
        help="Report what Manatal actually holds and where each field goes. Writes nothing.",
    )
    parsed.add_argument(
        "--verify",
        action="store_true",
        help="Check what the ledger claims is really in the platform. Writes nothing.",
    )
    parsed.add_argument(
        "--sample",
        type=int,
        default=0,
        help="With --inventory, read only this many candidates. A first look at an account does "
        "not need all of it, and reads less of somebody's data than a full walk.",
    )
    parsed.add_argument(
        "--no-archive",
        action="store_true",
        help="Do not write the raw record archive. Only sensible with --inventory: a real "
        "migration wants it, because Manatal is about to stop existing.",
    )
    parsed.add_argument(
        "--archive",
        type=Path,
        default=ARCHIVE_PATH,
        help=f"Where every raw Manatal record is kept (default {ARCHIVE_PATH}).",
    )
    parsed.add_argument(
        "--ledger",
        type=Path,
        default=DEFAULT_PATH,
        help=f"Where to keep the record of what was done (default {DEFAULT_PATH}).",
    )
    arguments = parsed.parse_args()

    # An inventory only reads Manatal. It touches no database and writes nothing to the
    # platform, so demanding the platform's credentials for one would be asking for the keys to
    # a house it never enters.
    needed = (
        ("MANATAL_API_TOKEN",)
        if arguments.inventory
        else (
            "SYNC_DATABASE_URL",
            "SYNC_SUPABASE_URL",
            "SYNC_SUPABASE_SERVICE_ROLE_KEY",
            "MANATAL_RECRUITER_ID",
        )
    )
    missing = [name for name in needed if not os.environ.get(name)]
    if not (
        arguments.publish_only or arguments.verify or arguments.inventory
    ) and not os.environ.get("MANATAL_API_TOKEN"):
        missing.append("MANATAL_API_TOKEN")
    if missing:
        raise SystemExit(f"Set these first: {', '.join(missing)}. See README.md.")

    return Options(
        database_url=os.environ.get("SYNC_DATABASE_URL", ""),
        supabase_url=os.environ.get("SYNC_SUPABASE_URL", ""),
        service_role_key=os.environ.get("SYNC_SUPABASE_SERVICE_ROLE_KEY", ""),
        manatal_token=os.environ.get("MANATAL_API_TOKEN", ""),
        recruiter_id=UUID(os.environ.get("MANATAL_RECRUITER_ID", str(NOBODY))),
        base_url=os.environ.get("MANATAL_API_BASE_URL", DEFAULT_BASE_URL),
        page_size=int(os.environ.get("MANATAL_PAGE_SIZE", "50")),
        limit=int(os.environ.get("MANATAL_LIMIT", "10000")),
        concurrency=int(os.environ.get("MANATAL_CONCURRENCY", "4")),
        timeout_seconds=float(os.environ.get("MANATAL_TIMEOUT_SECONDS", "120")),
        ledger_path=arguments.ledger,
        archive_path=arguments.archive,
        sample=arguments.sample,
        archiving=not arguments.no_archive,
        publish_only=arguments.publish_only,
        inventory_only=arguments.inventory,
        verify_only=arguments.verify,
    )


class Migration:
    """One run: import whoever is outstanding, then publish whatever has been parsed."""

    def __init__(
        self,
        pool: asyncpg.Pool,
        supabase: Supabase,
        manatal: Manatal | None,
        ledger: Ledger,
        archive: Archive,
        *,
        importer: writes.Importer,
        concurrency: int,
    ) -> None:
        self._pool = pool
        self._supabase = supabase
        self._manatal = manatal
        self._ledger = ledger
        self._archive = archive
        self._importer = importer
        self._concurrency = concurrency
        self._gate = asyncio.Semaphore(concurrency)
        self._locations: dict[str, str] = {}

    async def import_everyone(self, *, limit: int) -> int:
        """Every candidate Manatal holds that this migration has not settled yet."""
        if self._manatal is None:
            return 0
        self._locations = await writes.location_keys(self._pool)
        everyone = await self._manatal.everyone(limit=limit)
        # Before anything is written: Manatal is being switched off, so a field with no home
        # here still has to survive somewhere.
        kept = self._archive.keep(everyone)
        say(f"Archived {kept} new records to {self._archive.path} ({len(self._archive)} in total).")

        outstanding = [
            candidate
            for candidate in everyone
            if candidate.external_id and not self._ledger.is_settled(candidate.external_id)
        ]
        say(
            f"Manatal holds {len(everyone)} candidates; "
            f"{len(everyone) - len(outstanding)} already done, {len(outstanding)} to bring across."
        )
        walking = Progress(total=len(outstanding))
        for batch in _batched(outstanding, self._concurrency * 4):
            await asyncio.gather(*(self._bring_across(candidate) for candidate in batch))
            walking.advance(len(batch))
            say(walking.line())
        return len(outstanding)

    async def publish_parsed(self) -> int:
        """Profiles for the CVs the platform's worker has finished reading.

        Separate from importing because parsing is the worker's job and takes as long as it takes.
        Anything not ready yet is left for the next run.
        """
        waiting = self._ledger.awaiting_publication()
        if not waiting:
            return 0
        taxonomy, languages = await writes.vocabularies(self._pool)
        published = 0
        publishing = Progress(total=len(waiting))
        for entry in waiting:
            if await self._publish(entry, taxonomy, languages):
                published += 1
            publishing.advance()
            if publishing.done % 50 == 0 or publishing.done == publishing.total:
                say(publishing.line())
        say(f"Published {published} of {len(waiting)} profiles waiting on a parse.")
        return published

    async def _bring_across(self, candidate: Candidate) -> None:
        """One candidate, and never an exception: 5,000 of these cannot be stopped by one of them.

        The ledger keeps the reason instead, and a later run tries again.
        """
        async with self._gate:
            try:
                await self._import_one(candidate)
            except Exception as broke:
                self._ledger.record(
                    Entry(
                        manatal_candidate_id=candidate.external_id,
                        state=State.FAILED,
                        full_name=candidate.full_name,
                        email=candidate.email,
                        error=f"{type(broke).__name__}: {broke}"[:500],
                    )
                )

    async def _import_one(self, candidate: Candidate) -> None:
        if self._manatal is None:  # pragma: no cover — only reached with a Manatal client
            return
        known = self._ledger.of(candidate.external_id)
        if not candidate.email:
            self._ledger.record(_decided(candidate, State.NO_EMAIL))
            return
        try:
            resume = await self._manatal.resume(candidate)
        except ResumeMissingError:
            self._ledger.record(_decided(candidate, State.NO_RESUME))
            return

        file_hash = hashlib.sha256(resume.content).hexdigest()
        candidate_id = UUID(known.candidate_id) if known and known.candidate_id else None
        provisioned = False
        if candidate_id is None:
            if await writes.address_is_taken(self._pool, candidate.email):
                self._ledger.record(_decided(candidate, State.ALREADY_REGISTERED))
                return
            try:
                candidate_id = await self._supabase.create_account(email=candidate.email)
            except AddressTakenError:
                self._ledger.record(_decided(candidate, State.ALREADY_REGISTERED))
                return
            provisioned = True
            try:
                await writes.create_candidate(
                    self._pool,
                    candidate_id,
                    full_name=candidate.full_name or candidate.email,
                    headline=candidate.headline,
                    phone=candidate.phone,
                    avatar_url=candidate.picture_url,
                    location_key=writes.location_key_of(candidate.location, self._locations),
                    linkedin_url=linkedin_address(candidate.linkedin_url or "")
                    if candidate.linkedin_url
                    else None,
                    unmapped_skills=candidate.skills,
                )
            except BaseException:
                await self._undo(candidate_id)
                raise

        try:
            stored = await writes.store_cv(
                self._pool,
                candidate_id,
                display_name=resume.filename,
                file_hash=file_hash,
                media_type=resume.media_type,
            )
            if stored.is_new:
                try:
                    await self._supabase.upload_cv(
                        stored.storage_path, resume.content, media_type=resume.media_type
                    )
                except BaseException:
                    # No file means no CV: drop the row so the queued parse goes with it.
                    await writes.remove_cv_row(self._pool, stored.cv_id)
                    raise
            await writes.add_to_talent_pool(self._pool, self._importer, candidate_id)
            if candidate.tags:
                await writes.apply_tags(self._pool, self._importer, candidate_id, candidate.tags)
            written = _note_from(candidate)
            if written:
                await writes.keep_note(self._pool, self._importer, candidate_id, written)
        except BaseException:
            if provisioned:
                await self._undo(candidate_id)
            raise

        self._ledger.record(
            _decided(
                candidate,
                State.IMPORTED,
                candidate_id=candidate_id,
                cv_id=stored.cv_id,
                file_hash=file_hash,
            )
        )

    async def _publish(self, entry: Entry, taxonomy: dict[str, UUID], languages: list[str]) -> bool:
        if entry.candidate_id is None or entry.cv_id is None:  # pragma: no cover — guarded above
            return False
        candidate_id, cv_id = UUID(entry.candidate_id), UUID(entry.cv_id)
        state = await writes.parse_state(self._pool, cv_id)
        if not state.is_ready or state.parsed is None:
            return False
        if not await writes.profile_is_empty(self._pool, candidate_id):
            # Somebody has filled this in — a re-run, or the person themselves. Never overwritten.
            entry.state = State.PUBLISHED
            self._ledger.record(entry)
            return False

        profile = profile_from(
            state.parsed, candidate_id=candidate_id, taxonomy=taxonomy, languages=languages
        )
        if not profile.is_worth_publishing:
            say(f"  {entry.manatal_candidate_id}: the parse found nothing to publish, left alone.")
            entry.state = State.PUBLISHED
            self._ledger.record(entry)
            return False

        await writes.publish_profile(
            self._pool,
            candidate_id,
            cv_id,
            profile,
            writes.FromManatal(
                position=entry.position,
                company=entry.company,
                degree=entry.degree,
                university=entry.university,
                graduation_year=entry.graduation_year,
                english=entry.english,
            ),
            linkedin_url=writes.linkedin_from_parse(state.parsed),
        )
        entry.state = State.PUBLISHED
        self._ledger.record(entry)
        return True

    async def _undo(self, candidate_id: UUID) -> None:
        """Delete the account this attempt made. `profiles.id → auth.users` cascades, so this takes
        the Candidate row with it and leaves the address free to be tried again."""
        try:
            await self._supabase.delete_account(candidate_id)
        except Exception as broke:
            say(f"  ! left an account behind for {candidate_id}: {broke}")


def _custom_degree(candidate: Candidate) -> str | None:
    """The degree an account keeps in its own custom field, when Manatal's own is empty."""
    custom = candidate.raw.get("custom_fields")
    if not isinstance(custom, dict):
        return None
    for key in ("highestdegree", "highest_degree"):
        stated = custom.get(key)
        if isinstance(stated, str) and stated.strip():
            return stated.strip()
    return None


def _note_from(candidate: Candidate) -> str:
    """What a recruiter typed in Manatal, plus whatever the account kept in custom fields.

    Both are free text nobody here can key on, and both are somebody's work. A Note is where
    work like that lives in this platform. LinkedIn is stored on the profile instead.
    """
    written = [candidate.description] if candidate.description else []
    custom = candidate.raw.get("custom_fields")
    if isinstance(custom, dict):
        skip = {"linkedinprofile", "linkedin", "linkedin_url"}
        written += [
            f"{key.replace('_', ' ')}: {value}"
            for key, value in custom.items()
            if value and key.lower() not in skip
        ]
    if not written:
        return ""
    joined = "\n".join(written)
    return f"From Manatal:\n{joined}"


def _decided(
    candidate: Candidate,
    state: State,
    *,
    candidate_id: UUID | None = None,
    cv_id: UUID | None = None,
    file_hash: str | None = None,
) -> Entry:
    return Entry(
        manatal_candidate_id=candidate.external_id,
        state=state,
        full_name=candidate.full_name,
        email=candidate.email,
        position=candidate.headline,
        company=candidate.current_company,
        # Fallback chain: the dedicated field first, then the custom one an account keeps its
        # own version of, so a candidate with only one of the two still lands with a degree.
        degree=candidate.latest_degree or _custom_degree(candidate),
        university=candidate.latest_university,
        graduation_year=candidate.graduation_year,
        english=proficiency_of(candidate.english_spoken, candidate.english_written),
        candidate_id=None if candidate_id is None else str(candidate_id),
        cv_id=None if cv_id is None else str(cv_id),
        file_hash=file_hash,
    )


def _batched[T](items: list[T], size: int) -> list[list[T]]:
    return [items[start : start + size] for start in range(0, len(items), max(size, 1))]


def say(message: str) -> None:
    print(message, flush=True)


def readable_output() -> None:
    """Make stdout carry any name Manatal holds, whatever codepage the console starts in.

    Windows still opens a console in a legacy codepage, and this report is full of people's
    names. A migration must not die three hours in because a console could not encode one.
    """
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", errors="replace")


async def inventory(chosen: Options, manatal: Manatal) -> int:
    """What the account holds, and where each field goes. Writes nothing to the platform."""
    reading = chosen.sample or chosen.limit
    everyone = await manatal.everyone(limit=reading)
    if chosen.archiving:
        kept = Archive(chosen.archive_path).keep(everyone)
        say(f"Archived {kept} records to {chosen.archive_path}.")
    say("")
    for line in census_of(everyone).as_lines():
        say(line)
    return 0


async def verify(
    chosen: Options, pool: asyncpg.Pool, supabase: Supabase, manatal: Manatal | None
) -> int:
    """Read the platform back and compare it with the ledger. Writes nothing."""
    in_manatal: list[str] = []
    if manatal is not None:
        in_manatal = [
            candidate.external_id
            for candidate in await manatal.everyone(limit=chosen.limit)
            if candidate.external_id
        ]
    ledger = Ledger.at(chosen.ledger_path)
    verdict = await Verification(pool, supabase, ledger).run(in_manatal=in_manatal)
    for line in verdict.as_lines():
        say(line)
    return 0 if verdict.is_sound else 1


async def run(chosen: Options) -> int:
    if chosen.inventory_only:
        manatal = Manatal.build(
            base_url=chosen.base_url,
            token=chosen.manatal_token,
            timeout_seconds=chosen.timeout_seconds,
            page_size=chosen.page_size,
        )
        try:
            return await inventory(chosen, manatal)
        finally:
            await manatal.aclose()

    ledger = Ledger.at(chosen.ledger_path)
    archive = Archive(chosen.archive_path)
    pool = await writes.connect(chosen.database_url)
    supabase = Supabase.build(
        url=chosen.supabase_url,
        service_role_key=chosen.service_role_key,
        timeout_seconds=chosen.timeout_seconds,
    )
    manatal = (
        None
        if chosen.publish_only or (chosen.verify_only and not chosen.manatal_token)
        else Manatal.build(
            base_url=chosen.base_url,
            token=chosen.manatal_token,
            timeout_seconds=chosen.timeout_seconds,
            page_size=chosen.page_size,
        )
    )
    try:
        if chosen.verify_only:
            return await verify(chosen, pool, supabase, manatal)

        given = await writes.importer(pool, chosen.recruiter_id)
        say(
            f"Bringing candidates in as recruiter {given.recruiter_id} of tenant {given.tenant_id}."
        )
        migration = Migration(
            pool,
            supabase,
            manatal,
            ledger,
            archive,
            importer=given,
            concurrency=chosen.concurrency,
        )
        if not chosen.publish_only:
            await migration.import_everyone(limit=chosen.limit)
        await migration.publish_parsed()
    finally:
        if manatal is not None:
            await manatal.aclose()
        await supabase.aclose()
        await pool.close()

    return _report(ledger)


def _report(ledger: Ledger) -> int:
    tally = ledger.tally()
    say("")
    say(f"Ledger: {ledger.path} ({len(ledger)} candidates)")
    for state, total in sorted(tally.items()):
        say(f"  {state.value}: {total}")
    waiting = tally.get(State.IMPORTED, 0)
    if waiting:
        say("")
        say(
            f"{waiting} CVs are waiting on the platform's worker to parse them. Once it has, run "
            "this again with --publish-only to write their profiles and make them findable."
        )
    if tally.get(State.FAILED):
        say("Run this again to retry only what failed.")
        return 1
    say("")
    say("Then `--verify` reads the platform back and checks every claim in that ledger.")
    return 0


def main() -> None:
    readable_output()
    try:
        raise SystemExit(asyncio.run(run(options())))
    except (ManatalError, CandidateGoneError) as broke:
        raise SystemExit(f"Manatal: {broke}") from broke
    except writes.PlatformError as broke:
        raise SystemExit(str(broke)) from broke


if __name__ == "__main__":
    main()
