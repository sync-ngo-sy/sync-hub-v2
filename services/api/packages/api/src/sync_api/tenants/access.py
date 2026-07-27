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
    id: UUID
    name: str
    slug: str


@dataclass(frozen=True, slots=True)
class ActingRecruiter:
    profile: ActingProfile
    tenant: TenantSummary
    role: RecruiterRole

    @property
    def is_admin(self) -> bool:
        return self.role is RecruiterRole.ADMIN


async def acting_recruiter(session: AsyncSession, profile: ActingProfile) -> ActingRecruiter:
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
    if not recruiter.is_admin:
        raise Problem(
            status=403,
            type=TENANT_ADMIN_ONLY_PROBLEM_TYPE,
            detail="Only a tenant admin can do this.",
        )
    return recruiter


def _recruiter_only() -> Problem:
    return Problem(
        status=403,
        type=RECRUITER_ONLY_PROBLEM_TYPE,
        detail="This is only available to recruiter accounts.",
    )
