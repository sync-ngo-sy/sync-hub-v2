"""Who a tenant-scoped request is acting as, and the three ways that right is withdrawn.

ADR-0002 took every authorization check out of the database and gave it to the API, so this
is where a Recruiter's right to act inside their Tenant is established — once, in one place,
for every route that touches tenant data.

Three switches can revoke it, and each is a different sentence to the caller. Someone who is
not a Recruiter at all has come to the wrong half of the platform. A Recruiter whose
`is_active` is false has been let go by their own team, and their admins can undo it. A
Tenant whose `is_active` is false has been paused by the operator — the kill-switch — and
nobody inside that Tenant can undo that. All three are a 403, because all three are a
recognised caller being refused, but a client that only reads the status cannot tell a
departed colleague from a suspended company, so they carry distinct problem types.

The kill-switch is deliberately a read of `tenants.is_active` on every request rather than
anything cached: pausing a Tenant has to take effect on the next request, not on the next
sign-in, or an abusive tenant keeps working for as long as their sessions last.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.problems import (
    RECRUITER_DEACTIVATED_PROBLEM_TYPE,
    RECRUITER_ONLY_PROBLEM_TYPE,
    TENANT_ADMIN_ONLY_PROBLEM_TYPE,
    TENANT_SUSPENDED_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import AccountType, Recruiter, RecruiterRole, Tenant

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth import ActingProfile

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class TenantSummary:
    """The Tenant a Recruiter acts inside. Only ever built for an active one."""

    id: UUID
    name: str
    slug: str


@dataclass(frozen=True, slots=True)
class ActingRecruiter:
    """A Recruiter who is allowed, right now, to act inside their Tenant.

    Holding one is the proof: it cannot be constructed for a Candidate, for a deactivated
    Recruiter, or for a suspended Tenant, so a route that asks for one has already made
    every check the kill-switches imply.
    """

    profile: ActingProfile
    tenant: TenantSummary
    role: RecruiterRole

    @property
    def is_admin(self) -> bool:
        return self.role is RecruiterRole.ADMIN


async def acting_recruiter(session: AsyncSession, profile: ActingProfile) -> ActingRecruiter:
    """Establish the caller's standing inside their Tenant, or refuse with 403."""
    if profile.account_type is not AccountType.RECRUITER:
        raise _recruiter_only()

    row = (
        await session.execute(
            select(Recruiter.role, Recruiter.is_active, Tenant)
            .join(Tenant, Tenant.id == Recruiter.tenant_id)
            .where(Recruiter.id == profile.id)
        )
    ).first()
    if row is None:
        # A recruiter Profile with no Recruiter row is a provisioning bug, not a caller
        # error — but it is still a caller who cannot be placed in a Tenant, so refuse, and
        # say so in the log where someone can act on it.
        logger.error("tenants.recruiter_row_missing", profile_id=str(profile.id))
        raise _recruiter_only()

    role, is_active, tenant = row
    if not is_active:
        raise Problem(
            status=403,
            type=RECRUITER_DEACTIVATED_PROBLEM_TYPE,
            detail="Your access to this tenant has been turned off by an admin.",
        )
    if not tenant.is_active:
        raise Problem(
            status=403,
            type=TENANT_SUSPENDED_PROBLEM_TYPE,
            detail="This tenant is suspended. Contact Sync to restore it.",
        )

    return ActingRecruiter(
        profile=profile,
        tenant=TenantSummary(id=tenant.id, name=tenant.name, slug=tenant.slug),
        role=role,
    )


def require_admin(recruiter: ActingRecruiter) -> ActingRecruiter:
    """Narrow an acting Recruiter to one who runs the Tenant, or refuse with 403."""
    if not recruiter.is_admin:
        raise Problem(
            status=403,
            type=TENANT_ADMIN_ONLY_PROBLEM_TYPE,
            detail="Only a tenant admin can do this.",
        )
    return recruiter


def _recruiter_only() -> Problem:
    """One sentence for both ways of not being a usable Recruiter.

    A caller must not be able to tell "you are a Candidate" from "your Recruiter row is
    missing" — the second is our bug, and describing it to them says something about the
    platform's internals in exchange for nothing they can act on.
    """
    return Problem(
        status=403,
        type=RECRUITER_ONLY_PROBLEM_TYPE,
        detail="This is only available to recruiter accounts.",
    )
