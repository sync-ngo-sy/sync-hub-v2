"""Fill a local stack with a whole platform's worth of believable data.

    uv run python scripts/seed_demo.py                 # seed, refusing if a seed is already there
    uv run python scripts/seed_demo.py --purge         # take the previous one out first
    uv run python scripts/seed_demo.py --purge-only     # just take it out
    uv run python scripts/seed_demo.py --no-embed       # skip the OpenAI calls Global search needs

Three Tenants, nine Candidates, ten Jobs, nineteen Applications across every pipeline stage and
every Screening verdict, a month of campaign traffic, and the Tenant records — notes, Tags, the
Talent pool, Message templates, sent messages — that hang off all of it.

Almost none of it is written as SQL. An Application goes through `ApplicationService.submit`, so
its Snapshot is copied and its verdict computed by the code that owns those; a pipeline move goes
through the review service, so the status history, the Candidate's Notification and the rejection
email happen for the real reason. What that buys is a database you can trust while hunting for
gaps: anything that looks wrong in the product is the product, not the fixture.

Two things here are the seed's own and are labelled as such wherever they appear: the timestamps
(`history.py` moves the rows into the past afterwards, because every service correctly stamps
`now()`), and the delivery state of queued emails — `communications.provider` says `seed`, never
`resend`, because no provider ever saw them. **Nothing is emailed to anybody.** The invitations
the seed really does send land in Mailpit, like every other local email.

Reads the same `SYNC_*` settings the API does, and refuses to run against anything but a local
stack: it creates people who do not exist.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import TYPE_CHECKING, Final

from dotenv import load_dotenv
from httpx import AsyncClient
from seed import cast
from seed.history import backdate
from seed.identities import Identities, Removed, purge, tenants_by_slug, users_by_email
from seed.world import Seeded, World

from sync_api.auth import GoTrue
from sync_core import Database, Environment, Storage, configure_logging, get_settings
from sync_rag import ProfileEmbedding
from sync_rag.openai_embedder import OpenAiEmbedder
from sync_worker import ReembedEngine, ReembedPolicy

load_dotenv("./../.env")

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings

GOTRUE_TIMEOUT_SECONDS: Final = 20.0

#: Hosts a local Supabase stack answers on. Anything else is somebody's real environment.
LOCAL_HOSTS: Final = frozenset({"127.0.0.1", "localhost", "0.0.0.0", "supabase_kong_sync1"})

RETRY_IMMEDIATELY: Final = 0.001
STUCK_AFTER_SECONDS: Final = 600.0


def parse_arguments(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--purge",
        action="store_true",
        help="Remove a previous run of this seed first. Touches nothing else.",
    )
    parser.add_argument("--purge-only", action="store_true", help="Remove a previous run and stop.")
    parser.add_argument(
        "--no-embed",
        action="store_true",
        help="Skip building profile embeddings. Global search finds nobody without them.",
    )
    parser.add_argument("--yes", action="store_true", help="Do not ask before writing.")
    return parser.parse_args(argv)


def refuse_a_real_environment(settings: Settings) -> None:
    """A seed invents people, so it only ever runs somewhere nobody else is looking."""
    host = settings.supabase_url.host or ""
    if settings.environment is not Environment.LOCAL or host not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing to seed {settings.supabase_url} (SYNC_ENVIRONMENT="
            f"{settings.environment.value}). This script only runs against a local stack."
        )


def target_agreed(settings: Settings) -> bool:
    print(f"About to seed {settings.supabase_url} and its database.")
    return input("Go ahead? [y/N] ").strip().lower() == "y"


def seeded_emails() -> list[str]:
    """Every address the seed owns — what a purge is scoped to, and nothing beyond it."""
    return [
        cast.OPERATOR.email,
        *(person.email for tenant in cast.TENANTS for person in tenant.everyone),
        *(person.email for person in cast.CANDIDATES),
        *(asked.email for asked in cast.ACCESS_REQUESTS),
    ]


def seeded_slugs() -> list[str]:
    return [tenant.slug for tenant in cast.TENANTS]


async def run(*, arguments: argparse.Namespace) -> int:
    settings = get_settings()
    configure_logging(level=settings.log_level, log_format=settings.log_format)
    refuse_a_real_environment(settings)

    if not arguments.yes and not arguments.purge_only and not target_agreed(settings):
        print("Nothing was written.")
        return 1

    database = Database(settings)
    storage = Storage.build(settings)
    try:
        async with AsyncClient(timeout=GOTRUE_TIMEOUT_SECONDS) as http:
            gotrue = GoTrue(
                http,
                url=settings.gotrue_url,
                service_role_key=settings.supabase_service_role_key.get_secret_value(),
                anon_key=settings.supabase_anon_key.get_secret_value(),
            )
            identities = Identities(gotrue, http, settings)

            async with database.session() as session:
                if arguments.purge or arguments.purge_only:
                    removed = await purge(
                        session,
                        identities,
                        storage,
                        emails=seeded_emails(),
                        slugs=seeded_slugs(),
                    )
                    _report_purge(removed)
                    if arguments.purge_only:
                        return 0
                elif await _already_seeded(session):
                    print(
                        "This database already holds a seed. Run with --purge to replace it, or\n"
                        "--purge-only to just take it out. Nothing was written.",
                        file=sys.stderr,
                    )
                    return 1

                world = World(
                    session,
                    database=database,
                    gotrue=gotrue,
                    identities=identities,
                    storage=storage,
                    settings=settings,
                )
                seeded = await world.build()
                await backdate(session, seeded)

            embedded = 0
            if not arguments.no_embed:
                embedded = await _embed(database, settings)
            _report(seeded, embedded=embedded, settings=settings)
    finally:
        await database.dispose()
        await storage.aclose()
    return 0


async def _already_seeded(session: AsyncSession) -> bool:
    tenants = await tenants_by_slug(session, seeded_slugs())
    people = await users_by_email(session, seeded_emails())
    return bool(tenants or people)


async def _embed(database: Database, settings: Settings) -> int:
    """Build the profile chunks Global search reads, using the real embedder.

    Without these, `candidate_search_profiles` is empty and searching finds nobody — the
    Candidates are Searchable, but there is nothing to compare a query against. It is the one
    part of the seed that spends money, so it is roughly a tenth of a cent and skippable.
    """
    if settings.openai_api_key is None:
        print(
            "No SYNC_OPENAI_API_KEY, so no profile embeddings were built: Global search will\n"
            "find nobody until a worker runs. Everything else is seeded.",
            file=sys.stderr,
        )
        return 0

    embedder = OpenAiEmbedder.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_embedding_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )
    engine = ReembedEngine(
        database,
        ProfileEmbedding(database, embedder),
        ReembedPolicy(backoff_seconds=RETRY_IMMEDIATELY, stuck_after_seconds=STUCK_AFTER_SECONDS),
    )
    embedded = 0
    while await engine.run_once():
        embedded += 1
    return embedded


def _report_purge(removed: Removed) -> None:
    if not removed.anything:
        print("No previous seed to remove.")
        return
    print(
        f"Removed the previous seed: {removed.tenants} tenants, {removed.profiles} accounts, "
        f"{removed.jobs} jobs, {removed.applications} applications, {removed.cvs} CVs."
    )


def _report(seeded: Seeded, *, embedded: int, settings: Settings) -> None:
    print("\nSeeded:")
    for what, many in sorted(seeded.counts.items()):
        print(f"  {many:>4}  {what}")
    if embedded:
        print(f"  {embedded:>4}  candidate profiles embedded for Global search")

    print("\nSign in with one password everywhere:", cast.PASSWORD)
    print("\n  Platform Portal")
    print(f"    {cast.OPERATOR.email:<44} {cast.OPERATOR.full_name}")
    print("\n  Recruiter Portal")
    for tenant in cast.TENANTS:
        state = "" if tenant.is_active else "   (tenant suspended)"
        print(f"    {tenant.name} — {tenant.plan.value}{state}")
        for person in tenant.everyone:
            off = "" if person.is_active else "   (deactivated)"
            print(f"      {person.email:<42} {person.full_name}, {person.role.value}{off}")
    print("\n  Candidate Portal")
    for person in cast.CANDIDATES:
        searchable = "searchable" if person.profile.is_searchable else "not searchable"
        print(f"    {person.email:<44} {person.full_name} ({searchable})")

    print(f"\nEmails the seed sent land in Mailpit, not in an inbox: {_mailpit(settings)}")
    print("Nothing was delivered to a real address, and no queued Communication was sent.")


def _mailpit(settings: Settings) -> str:
    host = settings.supabase_url.host or "127.0.0.1"
    return f"http://{host}:54324"


def main(argv: Sequence[str] | None = None) -> int:
    return asyncio.run(run(arguments=parse_arguments(argv)))


if __name__ == "__main__":
    raise SystemExit(main())
