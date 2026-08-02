from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, ScalarSelect, func, select
from sqlalchemy.orm import DeclarativeBase

from sync_api.auth.gotrue import EmailAlreadyRegisteredError
from sync_api.auth.registration import identity_undone_unless_taken, invite_identity
from sync_api.problems import (
    INVITE_ALREADY_ACCEPTED_PROBLEM_TYPE,
    TENANT_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_api.tenants import Member
from sync_api.tenants.provisioning import provision_tenant, slug_taken
from sync_core import get_logger, transaction
from sync_core.models import (
    Application,
    Candidate,
    Job,
    Profile,
    Recruiter,
    Tenant,
    TenantPlan,
    User,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class TenantRecord:
    """A Tenant as the operator running the platform sees it — the roster's size, not its names."""

    id: UUID
    name: str
    slug: str
    plan: TenantPlan
    member_count: int
    is_active: bool
    invite_pending: bool


@dataclass(frozen=True, slots=True)
class CreatedTenant:
    tenant: TenantRecord
    founding_admin: Member


@dataclass(frozen=True, slots=True)
class PlatformCounts:
    tenants: int
    candidates: int
    jobs: int
    applications: int


@dataclass(frozen=True, slots=True)
class FoundingAdmin:
    member: Member
    invite_pending: bool


class PlatformService:
    """Every operation that spans the whole platform rather than one Tenant."""

    def __init__(self, session: AsyncSession, gotrue: GoTrue, *, recruiter_portal_url: str) -> None:
        self._db = session
        self._gotrue = gotrue
        self._recruiter_portal_url = recruiter_portal_url

    async def counts(self) -> PlatformCounts:
        """How big the platform is, in one round trip. Deleted Candidates keep their row — an
        Application a Tenant received still names it — so they are counted out explicitly."""
        tenants, candidates, jobs, applications = (
            (await self._db.execute(COUNTS_QUERY)).tuples().one()
        )
        return PlatformCounts(
            tenants=tenants, candidates=candidates, jobs=jobs, applications=applications
        )

    async def tenants(self) -> list[TenantRecord]:
        rows = await self._db.execute(TENANT_QUERY)
        return [_tenant_from(row) for row in rows.tuples()]

    async def create_tenant(
        self, *, name: str, slug: str, email: str, full_name: str
    ) -> CreatedTenant:
        """A Tenant and the admin who will run it, who is invited rather than given a password.

        Both refusals are asked before the invitation goes out, so a request that cannot succeed
        never puts a link in somebody's inbox. The constraints stay the backstop for the race.
        """
        await self._refuse_a_taken_slug(slug)
        user = await invite_identity(
            self._gotrue, self._db, email=email, redirect_to=self._recruiter_portal_url
        )
        async with identity_undone_unless_taken(self._gotrue, user.id):
            tenant = await provision_tenant(
                self._db, admin_id=user.id, name=name, slug=slug, full_name=full_name
            )

        logger.info("platform.tenant_created", tenant_id=str(tenant.id), profile_id=str(user.id))
        return CreatedTenant(
            tenant=await self._tenant(tenant.id),
            founding_admin=Member.founding(user, full_name),
        )

    async def resend_invite(self, tenant_id: UUID) -> Member:
        """Mail the founding admin their invitation again, which supersedes the first link."""
        await self._existing_tenant(tenant_id)
        founder = await self._founding_admin(tenant_id)
        if founder is None or not founder.invite_pending:
            raise _invite_already_accepted()

        try:
            await self._gotrue.invite_user(
                email=founder.member.email, redirect_to=self._recruiter_portal_url
            )
        except EmailAlreadyRegisteredError as exc:
            raise _invite_already_accepted() from exc

        logger.info("platform.invite_resent", tenant_id=str(tenant_id))
        return founder.member

    async def set_tenant_status(self, tenant_id: UUID, *, is_active: bool) -> TenantRecord:
        """Suspend a tenant or restore it. Nothing else changes: the roster, the Jobs and the
        Applications stay exactly as they were, and come back whole."""
        async with transaction(self._db):
            tenant = await self._existing_tenant(tenant_id)
            tenant.is_active = is_active

        logger.info("platform.tenant_status_set", tenant_id=str(tenant_id), is_active=is_active)
        return await self._tenant(tenant_id)

    async def _refuse_a_taken_slug(self, slug: str) -> None:
        if await self._db.scalar(select(Tenant.id).where(Tenant.slug == slug)) is not None:
            raise slug_taken(slug)

    async def _existing_tenant(self, tenant_id: UUID) -> Tenant:
        tenant = await self._db.get(Tenant, tenant_id)
        if tenant is None:
            raise _tenant_not_found()
        return tenant

    async def _founding_admin(self, tenant_id: UUID) -> FoundingAdmin | None:
        row = (
            await self._db.execute(FOUNDING_ADMIN_QUERY.where(Recruiter.tenant_id == tenant_id))
        ).first()
        if row is None:
            return None
        recruiter_id, full_name, email, confirmed_at, role, is_active = row
        return FoundingAdmin(
            member=Member(
                id=recruiter_id,
                full_name=full_name,
                email=email or "",
                role=role,
                is_active=is_active,
            ),
            invite_pending=confirmed_at is None,
        )

    async def _tenant(self, tenant_id: UUID) -> TenantRecord:
        rows = await self._db.execute(TENANT_QUERY.where(Tenant.id == tenant_id))
        return _tenant_from(rows.tuples().one())


def _total(entity: type[DeclarativeBase], *conditions: ColumnElement[bool]) -> ScalarSelect[int]:
    return select(func.count()).select_from(entity).where(*conditions).scalar_subquery()


COUNTS_QUERY = select(
    _total(Tenant),
    _total(Candidate, Candidate.deleted_at.is_(None)),
    _total(Job),
    _total(Application),
)

MEMBER_COUNT = (
    select(func.count())
    .select_from(Recruiter)
    .where(Recruiter.tenant_id == Tenant.id)
    .correlate(Tenant)
    .scalar_subquery()
)

#: The founding admin is the Tenant's first Recruiter. Nothing marks them, and nothing needs to:
#: a Tenant is opened with exactly one, and the roster only ever grows from there.
OLDEST_FIRST = (Recruiter.created_at, Recruiter.id)

FOUNDING_ADMIN_ID = (
    select(Recruiter.id)
    .where(Recruiter.tenant_id == Tenant.id)
    .order_by(*OLDEST_FIRST)
    .limit(1)
    .correlate(Tenant)
    .scalar_subquery()
)

INVITE_PENDING = (
    select(User.email_confirmed_at.is_(None))
    .where(User.id == FOUNDING_ADMIN_ID)
    .correlate(Tenant)
    .scalar_subquery()
)

TENANT_QUERY = select(Tenant, MEMBER_COUNT, INVITE_PENDING).order_by(Tenant.name, Tenant.slug)

FOUNDING_ADMIN_QUERY = (
    select(
        Recruiter.id,
        Profile.full_name,
        User.email,
        User.email_confirmed_at,
        Recruiter.role,
        Recruiter.is_active,
    )
    .join(Profile, Profile.id == Recruiter.id)
    .join(User, User.id == Recruiter.id)
    .order_by(*OLDEST_FIRST)
    .limit(1)
)


def _tenant_from(row: tuple[Tenant, int, bool | None]) -> TenantRecord:
    tenant, member_count, invite_pending = row
    return TenantRecord(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan=tenant.plan,
        member_count=member_count,
        is_active=tenant.is_active,
        invite_pending=bool(invite_pending),
    )


def _tenant_not_found() -> Problem:
    return Problem(
        status=404,
        type=TENANT_NOT_FOUND_PROBLEM_TYPE,
        detail="No tenant with that id.",
    )


def _invite_already_accepted() -> Problem:
    return Problem(
        status=409,
        type=INVITE_ALREADY_ACCEPTED_PROBLEM_TYPE,
        detail="This tenant's founding admin has no invitation outstanding.",
    )
