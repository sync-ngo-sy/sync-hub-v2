"""Bring a Manatal account's candidates and their CVs into Sync, once.

    uv run migrate.py

Run it, let the platform's worker parse what it stored, then run it again to publish the profiles.
See README.md. It changes no schema, adds no endpoint, and leaves nothing running.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final
from uuid import UUID

import platform_writes as writes
from ledger import DEFAULT_PATH, Entry, Ledger, State
from manatal import (
    CandidateGoneError,
    Manatal,
    ManatalError,
    ResumeMissingError,
)
from profile_rows import profile_from
from supabase_rest import AddressTakenError, Supabase

if TYPE_CHECKING:
    import asyncpg

    from manatal import Candidate

DEFAULT_BASE_URL: Final = "https://api.manatal.com/open/v3"


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
    publish_only: bool


def options() -> Options:
    parsed = argparse.ArgumentParser(description=__doc__)
    parsed.add_argument(
        "--publish-only",
        action="store_true",
        help="Skip Manatal entirely and only write profiles for CVs the worker has now parsed.",
    )
    parsed.add_argument(
        "--ledger",
        type=Path,
        default=DEFAULT_PATH,
        help=f"Where to keep the record of what was done (default {DEFAULT_PATH}).",
    )
    arguments = parsed.parse_args()

    missing = [
        name
        for name in (
            "SYNC_DATABASE_URL",
            "SYNC_SUPABASE_URL",
            "SYNC_SUPABASE_SERVICE_ROLE_KEY",
            "MANATAL_RECRUITER_ID",
        )
        if not os.environ.get(name)
    ]
    if not arguments.publish_only and not os.environ.get("MANATAL_API_TOKEN"):
        missing.append("MANATAL_API_TOKEN")
    if missing:
        raise SystemExit(f"Set these first: {', '.join(missing)}. See README.md.")

    return Options(
        database_url=os.environ["SYNC_DATABASE_URL"],
        supabase_url=os.environ["SYNC_SUPABASE_URL"],
        service_role_key=os.environ["SYNC_SUPABASE_SERVICE_ROLE_KEY"],
        manatal_token=os.environ.get("MANATAL_API_TOKEN", ""),
        recruiter_id=UUID(os.environ["MANATAL_RECRUITER_ID"]),
        base_url=os.environ.get("MANATAL_API_BASE_URL", DEFAULT_BASE_URL),
        page_size=int(os.environ.get("MANATAL_PAGE_SIZE", "50")),
        limit=int(os.environ.get("MANATAL_LIMIT", "10000")),
        concurrency=int(os.environ.get("MANATAL_CONCURRENCY", "4")),
        timeout_seconds=float(os.environ.get("MANATAL_TIMEOUT_SECONDS", "120")),
        ledger_path=arguments.ledger,
        publish_only=arguments.publish_only,
    )


class Migration:
    """One run: import whoever is outstanding, then publish whatever has been parsed."""

    def __init__(
        self,
        pool: asyncpg.Pool,
        supabase: Supabase,
        manatal: Manatal | None,
        ledger: Ledger,
        *,
        importer: writes.Importer,
        concurrency: int,
    ) -> None:
        self._pool = pool
        self._supabase = supabase
        self._manatal = manatal
        self._ledger = ledger
        self._importer = importer
        self._concurrency = concurrency
        self._gate = asyncio.Semaphore(concurrency)

    async def import_everyone(self, *, limit: int) -> int:
        """Every candidate Manatal holds that this migration has not settled yet."""
        if self._manatal is None:
            return 0
        everyone = await self._manatal.everyone(limit=limit)
        outstanding = [
            candidate
            for candidate in everyone
            if candidate.external_id and not self._ledger.is_settled(candidate.external_id)
        ]
        say(
            f"Manatal holds {len(everyone)} candidates; "
            f"{len(everyone) - len(outstanding)} already done, {len(outstanding)} to bring across."
        )
        done = 0
        for batch in _batched(outstanding, self._concurrency * 4):
            await asyncio.gather(*(self._bring_across(candidate) for candidate in batch))
            done += len(batch)
            say(f"  … {done}/{len(outstanding)}")
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
        for entry in waiting:
            if await self._publish(entry, taxonomy, languages):
                published += 1
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

        await writes.publish_profile(self._pool, candidate_id, cv_id, profile)
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
        candidate_id=None if candidate_id is None else str(candidate_id),
        cv_id=None if cv_id is None else str(cv_id),
        file_hash=file_hash,
    )


def _batched[T](items: list[T], size: int) -> list[list[T]]:
    return [items[start : start + size] for start in range(0, len(items), max(size, 1))]


def say(message: str) -> None:
    print(message, flush=True)


async def run(chosen: Options) -> int:
    ledger = Ledger.at(chosen.ledger_path)
    pool = await writes.connect(chosen.database_url)
    supabase = Supabase.build(
        url=chosen.supabase_url,
        service_role_key=chosen.service_role_key,
        timeout_seconds=chosen.timeout_seconds,
    )
    manatal = (
        None
        if chosen.publish_only
        else Manatal.build(
            base_url=chosen.base_url,
            token=chosen.manatal_token,
            timeout_seconds=chosen.timeout_seconds,
            page_size=chosen.page_size,
        )
    )
    try:
        given = await writes.importer(pool, chosen.recruiter_id)
        say(
            f"Bringing candidates in as recruiter {given.recruiter_id} of tenant {given.tenant_id}."
        )
        migration = Migration(
            pool,
            supabase,
            manatal,
            ledger,
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
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(run(options())))
    except (ManatalError, CandidateGoneError) as broke:
        raise SystemExit(f"Manatal: {broke}") from broke
    except writes.PlatformError as broke:
        raise SystemExit(str(broke)) from broke


if __name__ == "__main__":
    main()
