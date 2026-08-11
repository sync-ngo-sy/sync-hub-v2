from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sync_api.problems import (
    RECRUITER_DEACTIVATED_PROBLEM_TYPE,
    RECRUITER_ONLY_PROBLEM_TYPE,
    TENANT_ADMIN_ONLY_PROBLEM_TYPE,
    TENANT_SUSPENDED_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import AccountType, RecruiterRole

if TYPE_CHECKING:
    from uuid import UUID

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


def acting_recruiter(profile: ActingProfile) -> ActingRecruiter:
    if profile.account_type is not AccountType.RECRUITER:
        raise _recruiter_only()

    membership = profile.membership
    if membership is None:
        logger.error("tenants.recruiter_row_missing", profile_id=str(profile.id))
        raise _recruiter_only()

    if not membership.is_active:
        raise Problem(
            status=403,
            type=RECRUITER_DEACTIVATED_PROBLEM_TYPE,
            detail="Your access to this tenant has been turned off by an admin.",
        )
    if not membership.tenant.is_active:
        raise Problem(
            status=403,
            type=TENANT_SUSPENDED_PROBLEM_TYPE,
            detail="This tenant is suspended. Contact Sync Hub to restore it.",
        )

    return ActingRecruiter(
        profile=profile,
        tenant=TenantSummary(
            id=membership.tenant.id, name=membership.tenant.name, slug=membership.tenant.slug
        ),
        role=membership.role,
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
