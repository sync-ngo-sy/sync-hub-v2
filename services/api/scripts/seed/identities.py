"""The auth users behind the seed, and taking a previous seed back out.

Every account here is made through GoTrue, because that is where a password lives — a seed that
wrote `auth.users` itself would be guessing at another service's schema, and would stop working
the week that service changed. The Profile rows are then written by the same functions the
product uses, so a seeded Candidate and a signed-up one are the same three rows.

Two of the three kinds of account are normally *invited* rather than given a password: a
founding admin and a teammate both arrive through an emailed link. The seed lets that really
happen — the invitation is genuinely sent, and lands in Mailpit — and then settles the account
with a known password, so signing in as anybody needs no inbox round trip.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final, cast

from sqlalchemy import CursorResult, Delete, delete, or_, select, text, update

from sync_api.auth.gotrue import sdk_client
from sync_core import transaction
from sync_core.models import (
    AccessRequest,
    Application,
    ApplicationTagAssignment,
    Candidate,
    CandidateEducation,
    CandidateEmbeddingJob,
    CandidateExperience,
    CandidateLanguage,
    CandidateProfileChunk,
    CandidateProject,
    CandidateSkill,
    CandidateTagAssignment,
    Communication,
    Cv,
    Job,
    JobViewEvent,
    MessageTemplate,
    Note,
    Notification,
    PlatformAdmin,
    Profile,
    Recruiter,
    TalentPoolMember,
    Tenant,
    TenantTag,
    TrackedJobLink,
    User,
)

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterable, Sequence
    from uuid import UUID

    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth import GoTrue
    from sync_core import Settings, Storage


class Identities:
    """Making and settling the accounts a seed needs, and nothing else.

    Wraps `GoTrue` rather than replacing it: the one thing the product never needs — confirming
    somebody else's address out of band — is the one thing this adds, and it reaches for the same
    SDK client the API's own wrapper builds.
    """

    def __init__(self, gotrue: GoTrue, http: AsyncClient, settings: Settings) -> None:
        self._gotrue = gotrue
        self._admin = sdk_client(
            http,
            url=settings.gotrue_url,
            key=settings.supabase_service_role_key.get_secret_value(),
        )

    async def confirmed(self, *, email: str, password: str) -> UUID:
        """An account that can sign in immediately — how a Candidate arrives, minus the email."""
        user = await self._gotrue.create_user(email=email, password=password, confirmed=True)
        return user.id

    async def settle(self, user_id: UUID, *, password: str) -> None:
        """Give an invited account a password, and mark its address confirmed.

        Both halves are needed. A password alone leaves `email_confirmed_at` null, because
        redeeming the invitation is what would normally have set it, and GoTrue refuses to sign
        in an address it has not seen confirmed.
        """
        await self._admin.admin.update_user_by_id(
            str(user_id), {"password": password, "email_confirm": True}
        )

    async def forget(self, user_ids: Iterable[UUID]) -> None:
        for user_id in user_ids:
            await self._gotrue.delete_user(user_id)


@dataclass(frozen=True, slots=True)
class Removed:
    """What a purge took out, for the summary the script prints."""

    tenants: int
    profiles: int
    applications: int
    jobs: int
    cvs: int

    @property
    def anything(self) -> bool:
        return bool(self.tenants or self.profiles)


async def users_by_email(session: AsyncSession, emails: Sequence[str]) -> dict[str, UUID]:
    """Which of the seed's own addresses already have an account, keyed by address."""
    wanted = [address.lower() for address in emails]
    rows = await session.execute(select(User.email, User.id).where(User.email.in_(wanted)))
    return {str(email): user_id for email, user_id in rows.tuples() if email}


async def tenants_by_slug(session: AsyncSession, slugs: Sequence[str]) -> dict[str, UUID]:
    rows = await session.execute(select(Tenant.slug, Tenant.id).where(Tenant.slug.in_(slugs)))
    # `.all()` first: a `Result` carries a `keys()` of its own columns, so `dict()` over the
    # result itself reads it as a mapping and fails rather than pairing the two columns up.
    return dict(rows.tuples().all())


async def purge(
    session: AsyncSession,
    identities: Identities,
    storage: Storage,
    *,
    emails: Sequence[str],
    slugs: Sequence[str],
) -> Removed:
    """Take a previous run of this seed back out, and leave everything else alone.

    Scoped to the addresses and slugs the seed itself defines, never "everything": a developer
    who has been clicking around keeps whatever they made. The order below is the one the
    foreign keys allow, and each step says which constraint puts it where it is.
    """
    tenants = list((await tenants_by_slug(session, slugs)).values())
    people = list((await users_by_email(session, emails)).values())
    if not tenants and not people:
        return Removed(tenants=0, profiles=0, applications=0, jobs=0, cvs=0)

    # Before the rows go, because the paths are read off them.
    await _empty_storage_of(session, storage, people)

    async with transaction(session), without_the_written_once_guard(session):
        # `candidates_current_cv_fk` is ON DELETE RESTRICT: the pointer lets go before the CV
        # can. `is_searchable` goes with it — `candidates_searchable_needs_cv` will not have a
        # Candidate be findable with no CV, and it is right about that.
        await session.execute(
            update(Candidate)
            .where(Candidate.id.in_(people))
            .values(current_cv_id=None, is_searchable=False, profile_completed_at=None)
        )

        # Anything filed about a person or by a tenant. Both scopes, because a seeded Tenant may
        # have filed somebody the seed does not own, and vice versa.
        await session.execute(
            delete(ApplicationTagAssignment).where(ApplicationTagAssignment.tenant_id.in_(tenants))
        )
        await session.execute(
            delete(CandidateTagAssignment).where(
                or_(
                    CandidateTagAssignment.tenant_id.in_(tenants),
                    CandidateTagAssignment.candidate_id.in_(people),
                )
            )
        )
        await session.execute(
            delete(Note).where(or_(Note.tenant_id.in_(tenants), Note.candidate_id.in_(people)))
        )
        await session.execute(
            delete(TalentPoolMember).where(
                or_(
                    TalentPoolMember.tenant_id.in_(tenants),
                    TalentPoolMember.candidate_id.in_(people),
                )
            )
        )

        # Both point at `applications`, so both go first.
        await session.execute(
            delete(Communication).where(
                or_(Communication.tenant_id.in_(tenants), Communication.candidate_id.in_(people))
            )
        )
        await session.execute(
            delete(Notification).where(Notification.recipient_profile_id.in_(people))
        )

        applications = await _deleted(
            session,
            delete(Application).where(
                or_(Application.tenant_id.in_(tenants), Application.candidate_id.in_(people))
            ),
        )

        # Tracked links are referenced by applications (gone) and by view events (going now).
        seeded_jobs = select(Job.id).where(Job.tenant_id.in_(tenants))
        await session.execute(delete(JobViewEvent).where(JobViewEvent.job_id.in_(seeded_jobs)))
        await session.execute(delete(TrackedJobLink).where(TrackedJobLink.tenant_id.in_(tenants)))
        jobs = await _deleted(session, delete(Job).where(Job.tenant_id.in_(tenants)))

        await session.execute(delete(MessageTemplate).where(MessageTemplate.tenant_id.in_(tenants)))
        await session.execute(delete(TenantTag).where(TenantTag.tenant_id.in_(tenants)))
        cvs = await _deleted(session, delete(Cv).where(Cv.candidate_id.in_(people)))

        # A converted request names its Tenant; the tenant column is ON DELETE SET NULL, but the
        # request itself was the seed's, so it goes with it.
        await session.execute(delete(AccessRequest).where(AccessRequest.email.in_(emails)))
        await session.execute(delete(Recruiter).where(Recruiter.tenant_id.in_(tenants)))
        removed_tenants = await _deleted(session, delete(Tenant).where(Tenant.id.in_(tenants)))

        # The Profile and everything under it, deleted here rather than left to the cascade
        # from `auth.users`. GoTrue deletes that row as `supabase_auth_admin`, which has no
        # rights on any of these tables — migration 09 grants the public schema to
        # `service_role` and nobody else — so a cascade that reaches one fails the delete
        # with `permission denied`. The product never meets this, because deleting an
        # account bans the identity and keeps the row; only a purge really removes one.
        for owned in (
            CandidateEmbeddingJob,
            CandidateProfileChunk,
            CandidateExperience,
            CandidateEducation,
            CandidateSkill,
            CandidateLanguage,
            CandidateProject,
        ):
            await session.execute(delete(owned).where(owned.candidate_id.in_(people)))
        await session.execute(delete(Candidate).where(Candidate.id.in_(people)))
        await session.execute(delete(PlatformAdmin).where(PlatformAdmin.id.in_(people)))
        await session.execute(delete(Profile).where(Profile.id.in_(people)))

    # Last, and outside that transaction: the identity itself, which now has nothing under it.
    await identities.forget(people)

    return Removed(
        tenants=removed_tenants,
        profiles=len(people),
        applications=applications,
        jobs=jobs,
        cvs=cvs,
    )


#: The trigger a Snapshot and the two histories carry, refusing every update and delete — the
#: backend's service role included, which is the guarantee rather than an oversight.
WRITTEN_ONCE: Final = "written_once"


@asynccontextmanager
async def without_the_written_once_guard(session: AsyncSession) -> AsyncIterator[None]:
    """Turn the immutability triggers off, and put them back before the transaction commits.

    Deleting an Application whole is the one thing that legitimately takes a Snapshot with it,
    and only a purge ever does it. Which tables carry the guard is read from the catalogue
    rather than listed here, so a table added to the Snapshot later is covered by carrying the
    trigger and by nothing else.

    Putting them back is the whole job: `DISABLE TRIGGER` outlives the transaction that ran it,
    so a purge that only turned them off would leave every later Snapshot editable. A purge that
    fails part way rolls the disable back with everything else.

    One named trigger rather than `DISABLE TRIGGER USER`, so `updated_at` and the re-embed queue
    go on working; the foreign keys are untouched either way, because a cascade is an internal
    trigger.
    """
    guarded = list(
        await session.scalars(
            text("select tgrelid::regclass::text from pg_trigger where tgname = :name"),
            {"name": WRITTEN_ONCE},
        )
    )
    for table in guarded:
        await session.execute(text(f"alter table {table} disable trigger {WRITTEN_ONCE}"))
    try:
        yield
    finally:
        for table in guarded:
            await session.execute(text(f"alter table {table} enable trigger {WRITTEN_ONCE}"))


async def _deleted(session: AsyncSession, statement: Delete) -> int:
    """How many rows one delete took out. `execute` is typed as returning any `Result`;
    a DML statement always answers with the cursor-backed one that counts them."""
    done = cast("CursorResult[Any]", await session.execute(statement))
    return done.rowcount


async def _empty_storage_of(
    session: AsyncSession, storage: Storage, people: Sequence[UUID]
) -> None:
    if not people:
        return
    paths = await session.scalars(select(Cv.storage_path).where(Cv.candidate_id.in_(people)))
    for path in paths:
        try:
            await storage.remove(path)
        except Exception:  # a file already gone is no reason to stop a purge
            continue
