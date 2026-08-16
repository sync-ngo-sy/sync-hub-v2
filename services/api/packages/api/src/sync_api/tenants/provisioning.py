from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sqlalchemy.exc import IntegrityError

from sync_api.integrity import violated_constraint
from sync_api.problems import TENANT_SLUG_TAKEN_PROBLEM_TYPE, Problem
from sync_api.tenants.access import TenantSummary
from sync_api.tenants.presets import seed_presets
from sync_core import transaction
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

TENANT_SLUG_CONSTRAINT: Final = "tenants_slug_key"

#: Work that has to land in the same commit as the Tenant's own rows — recording the Access
#: request this Tenant came out of, for instance. Raising from it refuses the whole provisioning,
#: which is the point: there is no state where one of the two happened.
type SharedCommit = Callable[[AsyncSession, UUID], Awaitable[None]]


async def provision_tenant(
    session: AsyncSession,
    *,
    admin_id: UUID,
    name: str,
    slug: str,
    full_name: str,
    in_the_same_commit: SharedCommit | None = None,
) -> TenantSummary:
    """Everything a Tenant opens as, in the one order the constraints allow, in one transaction.

    The three rows a Tenant is, and then the Tags and Message templates it starts work with —
    attributed to the founding admin written a line above, who exists nowhere else yet.

    The identity already exists — however it was made — and this is only the Postgres half, so
    every caller wraps it in whichever undo suits how they made that identity.
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
            await session.flush()
            await seed_presets(session, tenant.id, admin_id)
            if in_the_same_commit is not None:
                await session.flush()
                await in_the_same_commit(session, tenant.id)
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
