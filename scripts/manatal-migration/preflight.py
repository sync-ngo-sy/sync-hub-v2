"""Everything that has to be true before a migration is worth starting.

This runs first, changes nothing, and is written for whoever is actually at the keyboard rather
than for whoever wrote the script. A migration that fails halfway is recoverable — the ledger
makes a re-run skip what finished — but it is still 5,000 people's records half-moved, and every
cause of that is knowable in advance: a key that has expired, a database nobody applied the
migration to, a taxonomy that is empty so nothing can match.

So each check answers one plain question, and a failed check says what to do about it rather than
what went wrong internally.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import UUID

import asyncpg
import httpx

from phones import ISO_COUNTRY

if TYPE_CHECKING:
    from collections.abc import Sequence

    from manatal import Manatal
    from supabase_rest import Supabase

#: The column the provenance migration adds. Its absence means the migration has not been
#: applied, and every import would fail on the very first insert.
PROVENANCE_COLUMN = "is_imported_from_manatal"

#: What an unset — or unreadable — recruiter id comes through as.
NOBODY: Final = UUID(int=0)


@dataclass(frozen=True, slots=True)
class Check:
    """One question, its answer, and what to do when the answer is no."""

    question: str
    passed: bool
    detail: str = ""
    fix: str = ""

    @property
    def line(self) -> str:
        mark = "OK  " if self.passed else "STOP"
        said = f"  {mark}  {self.question}"
        return f"{said} — {self.detail}" if self.detail else said


def summary(checks: Sequence[Check]) -> str:
    failed = [check for check in checks if not check.passed]
    if not failed:
        return "Everything checks out. The migration can run."
    return (
        f"{len(failed)} of {len(checks)} checks did not pass. "
        "Nothing has been changed. Fix the items marked STOP and run the check again."
    )


def passed(checks: Sequence[Check]) -> bool:
    return all(check.passed for check in checks)


def phone_region_check(region: str) -> Check:
    return Check(
        question=f"Is {region!r} a country code we can read phone numbers against?",
        passed=bool(ISO_COUNTRY.match(region)),
        detail="" if ISO_COUNTRY.match(region) else "it has to be two capital letters, like SY",
        fix="Set MANATAL_PHONE_REGION to the two-letter code for where most of these "
        "people's phone numbers are from.",
    )


async def manatal_check(manatal: Manatal | None, *, needed: bool = False) -> Check:
    question = "Does the Manatal key work?"
    if manatal is None:
        if needed:
            return Check(
                question,
                False,
                "no key is set, so it cannot be tried",
                "Set MANATAL_API_TOKEN, or just run the migration — it asks for the key when it "
                "needs one, and does not echo it as you type.",
            )
        return Check(question, True, "not needed for this run")
    try:
        reached = await manatal.everyone(limit=1)
    except Exception as broke:
        return Check(
            question,
            False,
            f"{type(broke).__name__}",
            "Check MANATAL_API_TOKEN. If it was rotated, get the current one from Manatal's "
            "own settings page.",
        )
    return Check(question, True, f"read {len(reached)} record back")


async def supabase_check(supabase: Supabase | None) -> Check:
    question = "Can we reach Supabase with the service key?"
    if supabase is None:
        return Check(question, True, "not needed for this run")
    try:
        await supabase.read_cv("preflight-does-not-exist")
    except Exception as broke:
        return Check(
            question,
            False,
            f"{type(broke).__name__}",
            "Check SYNC_SUPABASE_URL and SYNC_SUPABASE_SERVICE_ROLE_KEY. The service key is the "
            "secret one, not the anon key.",
        )
    return Check(question, True)


async def database_checks(database_url: str, recruiter_id: object) -> list[Check]:
    """Everything the database has to be able to say yes to, in one connection."""
    reachable = Check(
        "Can we reach the database?",
        False,
        fix="Check SYNC_DATABASE_URL. It has to be the connection string for the same "
        "environment as the Supabase URL above.",
    )
    try:
        connection = await asyncpg.connect(database_url)
    except Exception as broke:
        return [Check(reachable.question, False, f"{type(broke).__name__}", reachable.fix)]

    try:
        return [
            Check(reachable.question, True),
            await _provenance_check(connection),
            *await _taxonomy_checks(connection),
            await _recruiter_check(connection, recruiter_id),
        ]
    finally:
        await connection.close()


async def _provenance_check(connection: asyncpg.Connection) -> Check:
    present = await connection.fetchval(
        """
        select exists (
          select 1 from information_schema.columns
           where table_name = 'candidates' and column_name = $1
        )
        """,
        PROVENANCE_COLUMN,
    )
    return Check(
        "Has this environment had the database migrations applied?",
        bool(present),
        "" if present else f"candidates.{PROVENANCE_COLUMN} is not there",
        "Apply the migrations to this environment first. Without them there is nowhere to "
        "record that a Candidate came from Manatal.",
    )


async def _taxonomy_checks(connection: asyncpg.Connection) -> list[Check]:
    """The lists a candidate's details are matched against.

    An empty one is not an error the database would report — it just means nothing matches, and
    the migration quietly brings 5,000 people across with no location, no role and no skills,
    which leaves every one of them out of Global search.
    """
    wanted = {
        "locations": "locations",
        "canonical_roles": "roles",
        "skill_taxonomy": "skills",
        "languages": "languages",
    }
    checks: list[Check] = []
    for table, what in wanted.items():
        total = await connection.fetchval(f"select count(*) from {table}")
        checks.append(
            Check(
                f"Does the platform have its list of {what}?",
                bool(total),
                f"{total} {what}",
                f"Seed the {what} taxonomy first. Nothing can be matched to an empty list, and "
                "candidates whose details match nothing are migrated but not findable.",
            )
        )
    return checks


async def _recruiter_check(connection: asyncpg.Connection, recruiter_id: object) -> Check:
    question = "Is the recruiter this import is attributed to a real one?"
    fix = (
        "Set MANATAL_RECRUITER_ID to the id of the recruiter account these imports should be "
        "recorded against. Everything imported is filed to their Tenant."
    )
    if str(recruiter_id) == str(NOBODY):
        return Check(question, False, "no recruiter id is set, or it is not an id", fix)
    row = await connection.fetchrow(
        "select tenant_id from recruiters where id = $1 and is_active", recruiter_id
    )
    return Check(
        question,
        row is not None,
        "" if row is not None else f"no active recruiter with id {recruiter_id}",
        fix,
    )


async def run_checks(
    *,
    database_url: str,
    recruiter_id: object,
    manatal: Manatal | None,
    supabase: Supabase | None,
    phone_region: str,
    needs_platform: bool,
    needs_manatal: bool = True,
) -> list[Check]:
    """Every check that applies to this run, in the order they matter."""
    checks = [
        phone_region_check(phone_region),
        await manatal_check(manatal, needed=needs_manatal),
    ]
    if not needs_platform:
        return checks
    checks.append(await supabase_check(supabase))
    checks.extend(await database_checks(database_url, recruiter_id))
    return checks


async def reachable(url: str) -> bool:  # pragma: no cover — used by the launcher only
    """Whether a plain HTTP GET gets anywhere. For telling "wrong key" from "no network"."""
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            await http.get(url)
    except httpx.HTTPError:
        return False
    return True
