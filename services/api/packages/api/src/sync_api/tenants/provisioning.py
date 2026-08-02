from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sqlalchemy.exc import IntegrityError

from sync_api.integrity import violated_constraint
from sync_api.problems import TENANT_SLUG_TAKEN_PROBLEM_TYPE, Problem
from sync_api.tenants.access import TenantSummary
from sync_core import transaction
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

TENANT_SLUG_CONSTRAINT: Final = "tenants_slug_key"
PROFILE_CONSTRAINT: Final = "profiles_pkey"


async def provision_tenant(
    session: AsyncSession, *, admin_id: UUID, name: str, slug: str, full_name: str
) -> TenantSummary:
    """The three rows a Tenant is, in the one order the constraints allow, in one transaction.

    The identity already exists — however it was made — and this is only the Postgres half, so
    every caller stays responsible for undoing that identity when this refuses.
    """
    tenant = Tenant(name=name, slug=slug)
    try:
        async with transaction(session):
            session.add(tenant)
            await session.flush()
            session.add(
                Profile(id=admin_id, account_type=AccountType.RECRUITER, full_name=full_name)
            )
            await session.flush()
            session.add(Recruiter(id=admin_id, tenant_id=tenant.id, role=RecruiterRole.ADMIN))
    except IntegrityError as exc:
        if violated_constraint(exc) != TENANT_SLUG_CONSTRAINT:
            raise
        raise slug_taken(slug) from exc
    return TenantSummary(id=tenant.id, name=tenant.name, slug=tenant.slug)


def slug_taken(slug: str) -> Problem:
    return Problem(
        status=409,
        type=TENANT_SLUG_TAKEN_PROBLEM_TYPE,
        detail=f"The address “{slug}” is already taken. Choose another.",
    )


def is_already_provisioned(exc: BaseException) -> bool:
    """A Profile already exists for this identity — somebody's account, so not ours to undo."""
    return isinstance(exc, IntegrityError) and violated_constraint(exc) == PROFILE_CONSTRAINT
