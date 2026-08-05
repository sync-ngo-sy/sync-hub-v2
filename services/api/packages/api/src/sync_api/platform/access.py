from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sync_api.problems import PLATFORM_ADMIN_ONLY_PROBLEM_TYPE, Problem
from sync_core import get_logger
from sync_core.models import AccountType

if TYPE_CHECKING:
    from uuid import UUID

    from sync_api.auth import ActingProfile

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ActingPlatformAdmin:
    """The operator running the platform. Belongs to no Tenant, so carries none."""

    profile: ActingProfile

    @property
    def id(self) -> UUID:
        return self.profile.id


def acting_platform_admin(profile: ActingProfile) -> ActingPlatformAdmin:
    if profile.account_type is not AccountType.PLATFORM_ADMIN:
        raise _platform_admin_only()

    if not profile.has_account_row:
        logger.error("platform.admin_row_missing", profile_id=str(profile.id))
        raise _platform_admin_only()

    return ActingPlatformAdmin(profile=profile)


def _platform_admin_only() -> Problem:
    return Problem(
        status=403,
        type=PLATFORM_ADMIN_ONLY_PROBLEM_TYPE,
        detail="This is only available to platform admin accounts.",
    )
