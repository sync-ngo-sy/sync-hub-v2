"""Teammate invites and admin team management, from HTTP request to GoTrue and Postgres.

`invite_recruiter` is the one worth reading closely, and it is deliberately the mirror image
of `register_recruiter_tenant`: invite-as-provisioning (ADR-0005) means the Profile and
Recruiter rows are written *at invite time*, not when the invitee accepts, so an invite that
never gets opened still leaves the teammate a real (if password-less) member of the Tenant.
The identity is created first and deleted again if the Postgres write fails, via the same
`undo_identity` signup uses — but unlike signup, GoTrue's invite call sends the email itself
(ADR-0005 names this as "the GoTrue invite email"), so that email is already on its way
before the Postgres write is attempted. A write failure still cleans up the identity; the
invite link the invitee already has simply stops working, the same as any other expired one.

`load_acting_recruiter` is the gate every tenant-scoped route in this and future tickets
depends on: it is where `recruiters.is_active` and `tenants.is_active` — the two ways ADR-0002
demoted the database's own checks into the API — actually get enforced.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, select

from sync_api.auth.gotrue import EmailAlreadyRegisteredError
from sync_api.auth.service import undo_identity
from sync_api.problems import (
    ADMIN_ROLE_REQUIRED_PROBLEM_TYPE,
    EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
    RECRUITER_INACTIVE_PROBLEM_TYPE,
    RECRUITER_NOT_FOUND_PROBLEM_TYPE,
    RECRUITER_ONLY_PROBLEM_TYPE,
    TENANT_INACTIVE_PROBLEM_TYPE,
    TENANT_REQUIRES_AN_ADMIN_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant, User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth import ActingProfile
    from sync_api.auth.gotrue import GoTrue, GoTrueUser

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ActingRecruiter:
    """The Recruiter behind the request, already known to be usable.

    Exists only once both the Recruiter and its Tenant are active — every route depending on
    this needs no `is_active` check of its own, on either.
    """

    id: UUID
    tenant_id: UUID
    role: RecruiterRole


@dataclass(frozen=True, slots=True)
class RecruiterSummary:
    """A Recruiter as the tenant-management routes report it."""

    id: UUID
    email: str
    full_name: str
    role: RecruiterRole
    is_active: bool


class TenantService:
    """One request's worth of tenant-management work."""

    def __init__(self, session: AsyncSession, gotrue: GoTrue, *, recruiter_portal_url: str) -> None:
        self._db = session
        self._gotrue = gotrue
        self._recruiter_portal_url = recruiter_portal_url

    async def load_acting_recruiter(self, profile: ActingProfile) -> ActingRecruiter:
        """The Recruiter a verified Profile names, or a 403 it cannot act past.

        Depend on this from any tenant-scoped route — it is where "recruiter-scoped
        operation" from the ticket's acceptance criteria actually gets enforced.
        """
        if profile.account_type is not AccountType.RECRUITER:
            raise _recruiter_only()

        row = (
            await self._db.execute(
                select(Recruiter, Tenant.is_active)
                .join(Tenant, Tenant.id == Recruiter.tenant_id)
                .where(Recruiter.id == profile.id)
            )
        ).first()
        if row is None:
            # account_type says Recruiter but the row is missing: a bug in provisioning, not
            # something this caller did — the same "nobody" answer `_load_profile` gives a
            # live identity with no usable Profile.
            logger.warning("tenants.recruiter_missing", profile_id=str(profile.id))
            raise _recruiter_only()

        recruiter, tenant_is_active = row
        if not recruiter.is_active:
            raise Problem(
                status=403,
                type=RECRUITER_INACTIVE_PROBLEM_TYPE,
                detail="Your Recruiter account has been deactivated.",
            )
        if not tenant_is_active:
            raise Problem(
                status=403,
                type=TENANT_INACTIVE_PROBLEM_TYPE,
                detail="Your Tenant has been deactivated.",
            )
        return ActingRecruiter(id=recruiter.id, tenant_id=recruiter.tenant_id, role=recruiter.role)

    async def invite_recruiter(
        self, actor: ActingRecruiter, *, email: str, full_name: str, role: RecruiterRole
    ) -> RecruiterSummary:
        """Send the invite email and provision the Profile and Recruiter immediately.

        Inviting an address that already belongs to a Candidate (or another Recruiter) fails
        the same way a duplicate signup does: `auth.users.email` is unique regardless of
        which flow created the row, so GoTrue itself is what enforces Candidate XOR
        Recruiter here — nothing in this method has to check for it.
        """
        _require_admin(actor)
        try:
            user = await self._gotrue.invite_user(
                email=email, redirect_to=self._recruiter_portal_url
            )
        except EmailAlreadyRegisteredError as exc:
            raise Problem(
                status=409,
                type=EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
                detail="An account already exists for this email address.",
            ) from exc

        try:
            await self._provision_recruiter(
                user, tenant_id=actor.tenant_id, full_name=full_name, role=role
            )
        except BaseException:
            await undo_identity(self._gotrue, user.id)
            raise

        logger.info(
            "tenants.recruiter_invited", profile_id=str(user.id), tenant_id=str(actor.tenant_id)
        )
        return RecruiterSummary(
            id=user.id, email=user.email, full_name=full_name, role=role, is_active=True
        )

    async def list_recruiters(self, actor: ActingRecruiter) -> list[RecruiterSummary]:
        """Every Recruiter in the actor's own Tenant — how an admin finds a `recruiter_id`
        to act on once it is no longer sitting in an invite response."""
        rows = await self._db.execute(
            select(Recruiter, Profile.full_name, User.email)
            .join(Profile, Profile.id == Recruiter.id)
            .join(User, User.id == Recruiter.id)
            .where(Recruiter.tenant_id == actor.tenant_id)
            .order_by(Recruiter.created_at)
        )
        return [
            RecruiterSummary(
                id=recruiter.id,
                email=email or "",
                full_name=full_name,
                role=recruiter.role,
                is_active=recruiter.is_active,
            )
            for recruiter, full_name, email in rows
        ]

    async def update_recruiter(
        self,
        actor: ActingRecruiter,
        recruiter_id: UUID,
        *,
        role: RecruiterRole | None,
        is_active: bool | None,
    ) -> RecruiterSummary:
        """Change a teammate's role and/or activation. Admin-only, scoped to the actor's Tenant."""
        _require_admin(actor)
        row = (
            await self._db.execute(
                select(Recruiter, Profile.full_name, User.email)
                .join(Profile, Profile.id == Recruiter.id)
                .join(User, User.id == Recruiter.id)
                .where(Recruiter.id == recruiter_id, Recruiter.tenant_id == actor.tenant_id)
            )
        ).first()
        if row is None:
            raise Problem(
                status=404,
                type=RECRUITER_NOT_FOUND_PROBLEM_TYPE,
                detail="No Recruiter with that id in your Tenant.",
            )

        recruiter, full_name, email = row
        new_role = role if role is not None else recruiter.role
        new_is_active = is_active if is_active is not None else recruiter.is_active
        losing_admin_status = (
            recruiter.role is RecruiterRole.ADMIN
            and recruiter.is_active
            and not (new_role is RecruiterRole.ADMIN and new_is_active)
        )
        if losing_admin_status and not await self._has_another_active_admin(actor, recruiter.id):
            raise Problem(
                status=409,
                type=TENANT_REQUIRES_AN_ADMIN_PROBLEM_TYPE,
                detail="A Tenant must keep at least one active admin.",
            )

        if role is not None:
            recruiter.role = role
        if is_active is not None:
            recruiter.is_active = is_active
        await self._db.commit()

        logger.info(
            "tenants.recruiter_updated",
            profile_id=str(recruiter.id),
            role=recruiter.role.value,
            is_active=recruiter.is_active,
        )
        return RecruiterSummary(
            id=recruiter.id,
            email=email or "",
            full_name=full_name,
            role=recruiter.role,
            is_active=recruiter.is_active,
        )

    async def _has_another_active_admin(self, actor: ActingRecruiter, recruiter_id: UUID) -> bool:
        """Whether the Tenant has an active admin besides `recruiter_id`.

        Guards `update_recruiter` against a normal admin action stranding the Tenant with
        none — unlike the operator kill-switch, there is no recovery path in this ticket's
        scope once that happens.
        """
        count = await self._db.scalar(
            select(func.count())
            .select_from(Recruiter)
            .where(
                Recruiter.tenant_id == actor.tenant_id,
                Recruiter.role == RecruiterRole.ADMIN,
                Recruiter.is_active.is_(True),
                Recruiter.id != recruiter_id,
            )
        )
        return bool(count)

    async def _provision_recruiter(
        self, user: GoTrueUser, *, tenant_id: UUID, full_name: str, role: RecruiterRole
    ) -> None:
        """Write the Profile and the Recruiter in one transaction — the database-contracts
        write order for "Recruiter invite": Profile first, since the composite
        `(id, account_type)` foreign key makes the Recruiter row unreferenceable until it
        exists.

        Not wrapped in `session.begin()`: `load_acting_recruiter` already read from this same
        per-request session, which auto-begins a transaction on first use — a second
        `begin()` on top of it would raise. Committing here closes out that transaction, the
        read included; rolling back on failure is this method's own job now that `begin()`
        cannot do it automatically.
        """
        try:
            self._db.add(
                Profile(id=user.id, account_type=AccountType.RECRUITER, full_name=full_name)
            )
            await self._db.flush()
            self._db.add(Recruiter(id=user.id, tenant_id=tenant_id, role=role))
            await self._db.commit()
        except BaseException:
            await self._db.rollback()
            raise


def _require_admin(actor: ActingRecruiter) -> None:
    if actor.role is not RecruiterRole.ADMIN:
        raise Problem(
            status=403,
            type=ADMIN_ROLE_REQUIRED_PROBLEM_TYPE,
            detail="Only a Tenant admin can do that.",
        )


def _recruiter_only() -> Problem:
    return Problem(
        status=403,
        type=RECRUITER_ONLY_PROBLEM_TYPE,
        detail="This is available to Recruiters only.",
    )
