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
from getpass import getpass
from pathlib import Path
from typing import TYPE_CHECKING, Final
from uuid import UUID

import platform_writes as writes
import preflight
import report
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
from phones import DEFAULT_REGION, as_phone
from profile_rows import proficiency_of, profile_from
from progress import Progress
from supabase_rest import AddressTakenError, Supabase
from verify import Verification

if TYPE_CHECKING:
    from collections.abc import Sequence

    import asyncpg

    from manatal import Candidate

DEFAULT_BASE_URL: Final = "https://api.manatal.com/open/v3"

#: Where the readable account of a run is written. Beside the ledger, which holds the same facts
#: in a form only a program reads.
REPORT_PATH: Final = Path(__file__).resolve().parent / "manatal-migration-report.html"

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
    batch: int
    concurrency: int
    timeout_seconds: float
    ledger_path: Path
    archive_path: Path
    sample: int
    archiving: bool
    publish_only: bool
    inventory_only: bool
    verify_only: bool
    phone_region: str
    check_only: bool
    report_only: bool
    report_path: Path
    summary_path: Path | None


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
    parsed.add_argument(
        "--batch",
        type=int,
        default=None,
        help="Bring across at most this many people this run, then stop. For trying an account "
        "on a hundred before trusting it with all of them. Running it again does the next "
        "hundred, because whoever is already done is skipped. Unset means everybody.",
    )
    parsed.add_argument(
        "--check",
        action="store_true",
        help="Check that everything the migration needs is in place, change nothing, and say "
        "what to do about anything that is not. Run this first.",
    )
    parsed.add_argument(
        "--report",
        action="store_true",
        help="Say what the last run did, in plain words, and write it to a file you can open.",
    )
    parsed.add_argument(
        "--report-file",
        type=Path,
        default=REPORT_PATH,
        help=f"Where to write that report (default {REPORT_PATH}).",
    )
    parsed.add_argument(
        "--summary-file",
        type=Path,
        default=None,
        help="Also write the report as Markdown here. Point it at GITHUB_STEP_SUMMARY and the "
        "numbers appear on the run's own page, so nobody has to download anything.",
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
    if arguments.report:
        # The report only reads the ledger file. Asking for the keys to Manatal and the database
        # to read a file on this machine would be asking for more than the job needs.
        needed = ()
    if arguments.check:
        # Refusing to start because something is unset is exactly what `--check` exists to say,
        # one line at a time with a fix beside it, rather than as a wall on the way in.
        needed = ()
    missing = [name for name in needed if not os.environ.get(name)]
    # `--check` reports; it never asks for anything. A key it cannot see becomes a failed check
    # with a fix beside it, which is the whole point of running it.
    wants_the_token = not (
        arguments.publish_only
        or arguments.verify
        or arguments.inventory
        or arguments.report
        or arguments.check
    )
    if wants_the_token and not os.environ.get("MANATAL_API_TOKEN"):
        asked = _asked_for_the_token()
        if asked:
            os.environ["MANATAL_API_TOKEN"] = asked
        else:
            missing.append("MANATAL_API_TOKEN")
    if missing:
        raise SystemExit(_what_is_missing(missing))

    return Options(
        database_url=os.environ.get("SYNC_DATABASE_URL", ""),
        supabase_url=os.environ.get("SYNC_SUPABASE_URL", ""),
        service_role_key=os.environ.get("SYNC_SUPABASE_SERVICE_ROLE_KEY", ""),
        manatal_token=os.environ.get("MANATAL_API_TOKEN", ""),
        recruiter_id=_recruiter_id(),
        base_url=os.environ.get("MANATAL_API_BASE_URL", DEFAULT_BASE_URL),
        page_size=int(os.environ.get("MANATAL_PAGE_SIZE", "50")),
        limit=int(os.environ.get("MANATAL_LIMIT", "10000")),
        # The flag wins over the setting, so a one-off trial does not mean editing the config.
        batch=(
            arguments.batch
            if arguments.batch is not None
            else int(os.environ.get("MANATAL_BATCH", "0") or 0)
        ),
        concurrency=int(os.environ.get("MANATAL_CONCURRENCY", "4")),
        timeout_seconds=float(os.environ.get("MANATAL_TIMEOUT_SECONDS", "120")),
        ledger_path=arguments.ledger,
        archive_path=arguments.archive,
        sample=arguments.sample,
        archiving=not arguments.no_archive,
        publish_only=arguments.publish_only,
        inventory_only=arguments.inventory,
        verify_only=arguments.verify,
        phone_region=os.environ.get("MANATAL_PHONE_REGION", DEFAULT_REGION).upper(),
        check_only=arguments.check,
        report_only=arguments.report,
        report_path=arguments.report_file,
        summary_path=arguments.summary_file,
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
        phone_region: str = DEFAULT_REGION,
    ) -> None:
        self._pool = pool
        self._supabase = supabase
        self._manatal = manatal
        self._ledger = ledger
        self._archive = archive
        self._importer = importer
        self._concurrency = concurrency
        self._phone_region = phone_region
        self._gate = asyncio.Semaphore(concurrency)
        self._locations: dict[str, str] = {}
        self._roles: dict[str, str] = {}

    async def import_everyone(self, *, limit: int, batch: int = 0) -> int:
        """Every candidate Manatal holds that this migration has not settled yet.

        `batch` stops it after that many, so an account can be tried on a hundred people before
        it is trusted with five thousand.
        """
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
        taking = this_batch(outstanding, batch)
        if len(taking) < len(outstanding):
            say(
                f"Taking {len(taking)} of them this run, as asked. Run it again for the next "
                f"{min(batch, len(outstanding) - len(taking))}."
            )

        walking = Progress(total=len(taking))
        for group in _batched(taking, self._concurrency * 4):
            await asyncio.gather(*(self._bring_across(candidate) for candidate in group))
            walking.advance(len(group))
            say(walking.line())
        return len(taking)

    async def publish_parsed(self) -> int:
        """Profiles for the CVs the platform's worker has finished reading.

        Separate from importing because parsing is the worker's job and takes as long as it takes.
        Anything not ready yet is left for the next run.
        """
        waiting = self._ledger.awaiting_publication()
        if not waiting:
            return 0
        taxonomy, languages = await writes.vocabularies(self._pool)
        self._roles = await writes.role_keys(self._pool)
        published = 0
        publishing = Progress(total=len(waiting))
        stumbled = 0
        for entry in waiting:
            # Guarded per candidate, exactly as the import pass is. Unguarded, the first profile
            # the database refuses ends the whole pass, the entry stays `imported`, and every
            # later run walks back into the same one — so a single bad parse stops the other
            # 4,999 from ever being published.
            try:
                if await self._publish(entry, taxonomy, languages):
                    published += 1
            except Exception as broke:
                stumbled += 1
                entry.state = State.FAILED
                entry.error = f"{type(broke).__name__}: {broke}"[:500]
                self._ledger.record(entry)
            publishing.advance()
            if publishing.done % 50 == 0 or publishing.done == publishing.total:
                say(publishing.line())
        say(f"Published {published} of {len(waiting)} profiles waiting on a parse.")
        if stumbled:
            say(f"  {stumbled} could not be published and will be tried again on the next run.")
        return published

    async def _bring_across(self, candidate: Candidate) -> None:
        """One candidate, and never an exception: 5,000 of these cannot be stopped by one of them.

        The ledger keeps the reason instead, and a later run tries again.
        """
        async with self._gate:
            try:
                await self._import_one(candidate)
            except Exception as broke:
                # Whatever was already established about this candidate has to survive the
                # failure. Writing a bare entry would drop `candidate_id` and `cv_id`, and then
                # the next run — seeing no id — asks whether the address is taken, finds the
                # account this run made, and settles them as `already_registered` for good: the
                # account, the CV and the pool entry all exist, and the profile never publishes.
                known = self._ledger.of(candidate.external_id)
                failed = _decided(candidate, State.FAILED)
                if known is not None:
                    failed.candidate_id = known.candidate_id
                    failed.cv_id = known.cv_id
                    failed.file_hash = known.file_hash
                failed.error = f"{type(broke).__name__}: {broke}"[:500]
                self._ledger.record(failed)

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
                    full_name=candidate.full_name or writes.UNNAMED,
                    headline=writes.within_a_headline(candidate.headline),
                    phone=as_phone(candidate.phone, region=self._phone_region),
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

        uploaded: str | None = None
        try:
            intended = await writes.intended_cv(
                self._pool,
                candidate_id,
                file_hash=file_hash,
                media_type=resume.media_type,
            )
            stored = intended
            if intended.is_new:
                # The file first, then the row. Recording the row is what queues the parse, and
                # the worker is POSTed as soon as it is queued — so a row written before its
                # object exists sends the worker to fetch nothing, which fails terminally.
                await self._supabase.upload_cv(
                    intended.storage_path, resume.content, media_type=resume.media_type
                )
                uploaded = intended.storage_path
                try:
                    stored = await writes.record_cv(
                        self._pool,
                        candidate_id,
                        cv_id=intended.cv_id,
                        storage_path=intended.storage_path,
                        display_name=resume.filename,
                        file_hash=file_hash,
                        media_type=resume.media_type,
                    )
                except BaseException:
                    # An uploaded file with no row pointing at it is an orphan nothing collects.
                    await self._supabase.remove_cv(intended.storage_path)
                    raise
                if not stored.is_new:
                    # Somebody else won the race and their row names a different path.
                    await self._supabase.remove_cv(intended.storage_path)
            await writes.add_to_talent_pool(self._pool, self._importer, candidate_id)
            if candidate.tags:
                await writes.apply_tags(self._pool, self._importer, candidate_id, candidate.tags)
            written = _note_from(candidate)
            if written:
                await writes.keep_note(self._pool, self._importer, candidate_id, written)
        except BaseException:
            if provisioned:
                # `uploaded` rather than `stored.storage_path`: the object exists from the moment
                # the upload returns, which is before there is any row naming it.
                await self._undo(candidate_id, uploaded)
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
            entry.state = State.LEFT_ALONE
            self._ledger.record(entry)
            return False

        profile = profile_from(
            state.parsed, candidate_id=candidate_id, taxonomy=taxonomy, languages=languages
        )
        if not profile.is_worth_publishing:
            say(f"  {entry.manatal_candidate_id}: the parse found nothing to publish, left alone.")
            entry.state = State.LEFT_ALONE
            self._ledger.record(entry)
            return False

        known_skills, _ = writes.matched_skills(entry.skills, taxonomy)
        missing = await writes.publish_profile(
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
                matched_skills=known_skills,
            ),
            linkedin_url=writes.linkedin_from_parse(state.parsed),
            github_url=writes.github_from_parse(state.parsed),
            portfolio_url=writes.portfolio_from_parse(state.parsed),
            canonical_role_key=writes.role_from_parse(state.parsed, self._roles, entry.position),
            # Only where they agreed. Global search reaches every Tenant, and nobody consented to
            # that by having been in somebody's ATS.
            may_be_searched=entry.consent,
        )
        entry.state = State.PUBLISHED
        entry.missing = [requirement.value for requirement in missing]
        self._ledger.record(entry)
        return True

    async def _undo(self, candidate_id: UUID, stored_at: str | None = None) -> None:
        """Delete the account this attempt made. `profiles.id → auth.users` cascades, so this takes
        the Candidate row with it and leaves the address free to be tried again.

        The bucket is not in that cascade. #121 asked for a failed import to leave no orphan auth
        user *and* no orphan file, so the object goes explicitly or not at all.
        """
        if stored_at is not None:
            try:
                await self._supabase.remove_cv(stored_at)
            except Exception as broke:
                say(f"  ! left a file behind at {stored_at}: {broke}")
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
        skills=list(candidate.skills),
        consent=candidate.consent,
        candidate_id=None if candidate_id is None else str(candidate_id),
        cv_id=None if cv_id is None else str(cv_id),
        file_hash=file_hash,
    )


def this_batch[T](outstanding: list[T], batch: int) -> list[T]:
    """How many of the outstanding to bring across in this run.

    A cap on the *outstanding* rather than on what is read from Manatal, which is the difference
    between "do a hundred more each time" and "do the same hundred every time": the settled are
    filtered out before this, so consecutive runs march through the account instead of re-reading
    the front of it and finding nothing left to do.

    Zero or less means no cap, so leaving it unset migrates everybody.
    """
    return outstanding if batch <= 0 else outstanding[:batch]


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
    verdict = await Verification(
        pool, supabase, ledger, concurrency=chosen.concurrency, announce=say
    ).run(in_manatal=in_manatal)
    for line in verdict.as_lines():
        say(line)
    return 0 if verdict.is_sound else 1


async def check(chosen: Options) -> int:
    """Answer every question that has to be yes, change nothing, and say what to do about
    anything answered no."""
    manatal = (
        None
        if not chosen.manatal_token
        else Manatal.build(
            base_url=chosen.base_url,
            token=chosen.manatal_token,
            timeout_seconds=chosen.timeout_seconds,
            page_size=chosen.page_size,
        )
    )
    supabase = (
        None
        if not (chosen.supabase_url and chosen.service_role_key)
        else Supabase.build(
            url=chosen.supabase_url,
            service_role_key=chosen.service_role_key,
            timeout_seconds=chosen.timeout_seconds,
        )
    )
    try:
        checks = await preflight.run_checks(
            database_url=chosen.database_url,
            recruiter_id=chosen.recruiter_id,
            manatal=manatal,
            supabase=supabase,
            phone_region=chosen.phone_region,
            needs_platform=not chosen.inventory_only,
            needs_manatal=not chosen.publish_only,
        )
    finally:
        if manatal is not None:
            await manatal.aclose()
        if supabase is not None:
            await supabase.aclose()

    say("")
    say("Checking everything the migration needs before it starts:")
    say("")
    for one in checks:
        say(one.line)
    say("")
    say(preflight.summary(checks))
    for one in checks:
        if not one.passed and one.fix:
            say("")
            say(f"  {one.question}")
            say(f"    {one.fix}")
    say("")
    return 0 if preflight.passed(checks) else 1


def written_report(chosen: Options) -> int:
    """The last run's outcome, from the ledger, in words and as a file to keep."""
    ledger = Ledger.at(chosen.ledger_path)
    if not len(ledger):
        say(f"No migration has run yet — {chosen.ledger_path} is empty.")
        return 0
    return _report(ledger, chosen.report_path, chosen.summary_path)


async def run(chosen: Options) -> int:
    if chosen.check_only:
        return await check(chosen)
    if chosen.report_only:
        return written_report(chosen)
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
            phone_region=chosen.phone_region,
        )
        if not chosen.publish_only:
            await migration.import_everyone(limit=chosen.limit, batch=chosen.batch)
        await migration.publish_parsed()
    finally:
        if manatal is not None:
            await manatal.aclose()
        await supabase.aclose()
        await pool.close()

    return _report(ledger, chosen.report_path, chosen.summary_path)


def _recruiter_id() -> UUID:
    """The recruiter to attribute imports to, or nobody.

    Something that is not an id at all comes back as `NOBODY` rather than as an exception, so
    `--check` gets to say "that is not a recruiter id" in one line. A traceback is not an answer
    to somebody who did not write this.
    """
    written = os.environ.get("MANATAL_RECRUITER_ID", "").strip()
    try:
        return UUID(written)
    except ValueError:
        return NOBODY


def _asked_for_the_token() -> str:
    """Ask for the Manatal key rather than requiring it to have been set.

    `getpass` does not echo it and nothing here writes it down, so the key does not end up in a
    file, in the shell's history, or on the screen behind somebody. An operator who cannot be
    asked — a scheduled run with no terminal — gets the environment variable instead.
    """
    if not sys.stdin.isatty():  # pragma: no cover — a run with nobody at the keyboard
        return ""
    say("")
    say("The Manatal API key is needed. It is not shown as you type, and is not saved anywhere.")
    say("Find it in Manatal under Settings, API. Press Enter alone to stop.")
    try:
        return getpass("Manatal API key: ").strip()
    except (EOFError, KeyboardInterrupt):  # pragma: no cover — the operator gave up
        return ""


def _what_is_missing(missing: Sequence[str]) -> str:
    """What is not set, and what each one is, rather than a list of variable names."""
    means = {
        "SYNC_DATABASE_URL": "the connection string for the Sync database",
        "SYNC_SUPABASE_URL": "the address of the Sync Supabase project",
        "SYNC_SUPABASE_SERVICE_ROLE_KEY": "that project's service role key, the secret one",
        "MANATAL_RECRUITER_ID": "the id of the recruiter these imports are recorded against",
        "MANATAL_API_TOKEN": "the Manatal API key",
    }
    said = [f"  {name} — {means.get(name, 'see README.md')}" for name in missing]
    return "\n".join(
        ["", "These have to be set before the migration can run:", "", *said, "", "See README.md."]
    )


def _report(ledger: Ledger, report_path: Path, summary_path: Path | None = None) -> int:
    tally = ledger.tally()
    result = report.outcome_of(ledger)
    for line in report.lines(result):
        say(line)
    report_path.write_text(report.as_html(result, ledger_path=ledger.path), encoding="utf-8")
    if summary_path is not None:
        # Appended: a summary file may already hold what earlier steps of the same run wrote.
        with summary_path.open("a", encoding="utf-8") as summary:
            summary.write(report.as_markdown(result))
    say("")
    say(f"The same report, as a file you can open and send on: {report_path}")
    say(f"The full record of who became whom: {ledger.path} — keep it.")
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
