"""Onboarding a hiring company, and running its roster afterwards.

Two things happen here that are worth reading closely.

**Signup** creates four records across two authorities — an identity in GoTrue, and a
Tenant, a Profile and a Recruiter in Postgres — and can be refused by either. The unique
slug means it can be refused *after* the identity exists, which is the case
`sync_api.auth.registration` is for.

**Inviting is provisioning.** There is no invitations table, by design: the Profile and the
Recruiter are written the moment the invite is sent, so an invited teammate is a member of
the Tenant from that moment, merely one who cannot sign in yet because they have no
password. What GoTrue's invite mints is the token that lets them set one
(`AuthService.accept_invite`). The cost of the design is that a never-accepted invite leaves
a real Recruiter row an admin has to deactivate; the benefit is that there is one place a
member can be, so no route ever has to ask whether someone is a member *yet*.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from sync_api.auth.gotrue import EmailAlreadyRegisteredError
from sync_api.auth.registration import (
    create_identity,
    email_already_registered,
    identity_undone_on_failure,
    undo_identity,
)
from sync_api.problems import (
    LAST_TENANT_ADMIN_PROBLEM_TYPE,
    MEMBER_NOT_FOUND_PROBLEM_TYPE,
    TENANT_SLUG_TAKEN_PROBLEM_TYPE,
    Problem,
)
from sync_api.tenants.access import TenantSummary
from sync_api.transactions import transaction
from sync_core import get_logger
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant, User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueUser

logger = get_logger(__name__)

#: Two constraints from migration 02 that this module answers for by name. Postgres reports
#: which one it refused on, and that is how a 409 here can say *what* was taken rather than
#: that something was.
TENANT_SLUG_CONSTRAINT: Final = "tenants_slug_key"
PROFILE_CONSTRAINT: Final = "profiles_pkey"


@dataclass(frozen=True, slots=True)
class Member:
    """One Recruiter as their colleagues see them."""

    id: UUID
    full_name: str
    email: str
    role: RecruiterRole
    is_active: bool


@dataclass(frozen=True, slots=True)
class NewTenant:
    """What self-serve signup produced: the organization and the person who now runs it."""

    tenant: TenantSummary
    admin: Member


class TenantService:
    """One request's worth of tenant work."""

    def __init__(self, session: AsyncSession, gotrue: GoTrue, *, invite_redirect_url: str) -> None:
        self._db = session
        self._gotrue = gotrue
        self._invite_redirect_url = invite_redirect_url

    async def sign_up(
        self, *, tenant_name: str, slug: str, email: str, password: str, full_name: str
    ) -> NewTenant:
        """Create the Tenant, its founding admin, and the identity behind them.

        Returns before the address is confirmed, exactly like a candidate signup: the
        founder proves they own the address before they get a session.
        """
        user = await create_identity(self._gotrue, email=email, password=password)
        async with identity_undone_on_failure(self._gotrue, user.id):
            tenant = await self._provision_tenant(
                user, tenant_name=tenant_name, slug=slug, full_name=full_name
            )
            await self._gotrue.send_confirmation_email(email)

        logger.info("tenants.signed_up", tenant_id=str(tenant.id), profile_id=str(user.id))
        return NewTenant(
            tenant=tenant,
            admin=Member(
                id=user.id,
                full_name=full_name,
                email=user.email,
                role=RecruiterRole.ADMIN,
                is_active=True,
            ),
        )

    async def members(self, tenant_id: UUID) -> list[Member]:
        """Everyone on the Tenant's roster, deactivated colleagues included.

        Deactivated on purpose: an admin cannot reactivate someone they cannot see.
        """
        rows = await self._db.execute(
            MEMBER_QUERY.where(Recruiter.tenant_id == tenant_id).order_by(Profile.full_name)
        )
        return [_member_from(row) for row in rows.tuples()]

    async def invite(
        self, *, tenant_id: UUID, email: str, full_name: str, role: RecruiterRole
    ) -> Member:
        """Mail an invitation, and put the invitee on the roster in the same breath."""
        if await self._address_is_taken(email):
            raise email_already_registered()

        try:
            user = await self._gotrue.invite_user(
                email=email, redirect_to=self._invite_redirect_url
            )
        except EmailAlreadyRegisteredError as exc:
            raise email_already_registered() from exc

        try:
            async with transaction(self._db):
                self._db.add(
                    Profile(id=user.id, account_type=AccountType.RECRUITER, full_name=full_name)
                )
                await self._db.flush()
                self._db.add(Recruiter(id=user.id, tenant_id=tenant_id, role=role))
        except BaseException as exc:
            # The one failure this flow must *not* undo. Two invitations of the same new
            # address can both pass the check above; GoTrue creates the identity for the
            # first and hands the second that very same user, so the loser collides on
            # `profiles_pkey`. Deleting the identity then would cascade away the Profile and
            # Recruiter the winner has already committed — and it has already answered 201.
            # So the loser reports the address as taken, which by then it is, and leaves the
            # identity to its rightful owner. Every other failure is ours to undo.
            if _is_already_provisioned(exc):
                raise email_already_registered() from exc
            await undo_identity(self._gotrue, user.id)
            raise

        logger.info("tenants.invited", tenant_id=str(tenant_id), profile_id=str(user.id))
        return Member(id=user.id, full_name=full_name, email=user.email, role=role, is_active=True)

    async def change_member(
        self,
        *,
        tenant_id: UUID,
        recruiter_id: UUID,
        role: RecruiterRole | None = None,
        is_active: bool | None = None,
    ) -> Member:
        """Change a colleague's role, their access, or both."""
        async with transaction(self._db):
            recruiter = await self._db.get(Recruiter, recruiter_id)
            if recruiter is None or recruiter.tenant_id != tenant_id:
                # Deliberately the same answer as a recruiter_id that does not exist: an
                # admin must not be able to probe another Tenant's roster for membership.
                raise Problem(
                    status=404,
                    type=MEMBER_NOT_FOUND_PROBLEM_TYPE,
                    detail="No such member of this tenant.",
                )
            if role is not None:
                recruiter.role = role
            if is_active is not None:
                recruiter.is_active = is_active
            await self._db.flush()

            # Checked after the write rather than before it, so one condition covers every
            # way to reach it — demotion, deactivation, and an admin doing either to
            # themselves. Raising inside the transaction is what undoes it.
            if not await self._has_an_active_admin(tenant_id):
                raise Problem(
                    status=409,
                    type=LAST_TENANT_ADMIN_PROBLEM_TYPE,
                    detail="A tenant has to keep at least one active admin.",
                )

        logger.info(
            "tenants.member_changed", tenant_id=str(tenant_id), profile_id=str(recruiter_id)
        )
        return await self._member(recruiter_id)

    async def _provision_tenant(
        self, user: GoTrueUser, *, tenant_name: str, slug: str, full_name: str
    ) -> TenantSummary:
        """Write the Tenant, the Profile and the Recruiter in one transaction.

        Ordered, not merely batched: the Recruiter's composite `(id, account_type)` foreign
        key makes it unreferenceable until its Profile exists, and its `tenant_id` until the
        Tenant does — so the flushes between them are what the schema requires rather than a
        convenience.
        """
        tenant = Tenant(name=tenant_name, slug=slug)
        try:
            async with transaction(self._db):
                self._db.add(tenant)
                await self._db.flush()
                self._db.add(
                    Profile(id=user.id, account_type=AccountType.RECRUITER, full_name=full_name)
                )
                await self._db.flush()
                self._db.add(Recruiter(id=user.id, tenant_id=tenant.id, role=RecruiterRole.ADMIN))
        except IntegrityError as exc:
            if _violated_constraint(exc) != TENANT_SLUG_CONSTRAINT:
                raise
            # The one constraint-backed 409 in the API that deliberately does *not* carry the
            # id of the row it collided with. Elsewhere that id is the caller's own resource
            # and handing it back saves them a request; here it belongs to a different
            # company, and this endpoint is unauthenticated — so returning it would turn
            # signup into a way to enumerate tenants.
            raise Problem(
                status=409,
                type=TENANT_SLUG_TAKEN_PROBLEM_TYPE,
                detail=f"The address “{slug}” is already taken. Choose another.",
            ) from exc
        return TenantSummary(id=tenant.id, name=tenant.name, slug=tenant.slug)

    async def _address_is_taken(self, email: str) -> bool:
        """Whether `auth.users` already knows this address — asked *before* GoTrue is called.

        Everywhere else the platform lets the identity provider be the judge of that, and a
        409 falls out of its refusal. Inviting cannot: GoTrue's invite endpoint deliberately
        re-invites an address whose user exists but has never confirmed, answering with that
        existing user rather than an error. Left to it, a second invitation to a teammate who
        has not accepted yet would collide on `profiles_pkey` — and undoing *that* would
        delete the identity of a member who is already on the roster.

        So the question is asked here, where the answer costs one SELECT and no side effects
        at all. GoTrue's own refusal is still translated below, for the race this cannot see.
        """
        found = await self._db.scalar(
            select(User.id).where(func.lower(User.email) == email.lower())
        )
        return found is not None

    async def _has_an_active_admin(self, tenant_id: UUID) -> bool:
        total = await self._db.scalar(
            select(func.count())
            .select_from(Recruiter)
            .where(
                Recruiter.tenant_id == tenant_id,
                Recruiter.role == RecruiterRole.ADMIN,
                Recruiter.is_active.is_(True),
            )
        )
        return bool(total)

    async def _member(self, recruiter_id: UUID) -> Member:
        rows = await self._db.execute(MEMBER_QUERY.where(Recruiter.id == recruiter_id))
        return _member_from(rows.tuples().one())


#: Recruiter, name and address in one row. The address is read from `auth.users` because
#: that is the only place a Profile's email lives (the shared-PK identity, supabase ADR-0001).
#: A `Select` is generative — every `.where()` returns a new one — so sharing this is safe.
MEMBER_QUERY = (
    select(Recruiter.id, Profile.full_name, User.email, Recruiter.role, Recruiter.is_active)
    .join(Profile, Profile.id == Recruiter.id)
    .join(User, User.id == Recruiter.id)
)


def _member_from(row: tuple[UUID, str, str | None, RecruiterRole, bool]) -> Member:
    recruiter_id, full_name, email, role, is_active = row
    return Member(
        id=recruiter_id,
        full_name=full_name,
        email=email or "",
        role=role,
        is_active=is_active,
    )


def _is_already_provisioned(exc: BaseException) -> bool:
    """Whether this failure is "that identity is already somebody's Profile"."""
    return isinstance(exc, IntegrityError) and _violated_constraint(exc) == PROFILE_CONSTRAINT


def _violated_constraint(exc: IntegrityError) -> str | None:
    """The name of the constraint Postgres refused on, wherever the driver put it.

    asyncpg carries it on its own exception, which SQLAlchemy wraps twice over, so the walk
    down `__cause__` is what finds it under either layer.
    """
    error: BaseException | None = exc.orig
    while error is not None:
        name = getattr(error, "constraint_name", None)
        if isinstance(name, str):
            return name
        error = error.__cause__
    return None
