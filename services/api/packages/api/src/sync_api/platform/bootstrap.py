from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sync_api.auth.registration import identity_undone_on_failure
from sync_core import get_logger, transaction
from sync_core.models import AccountType, PlatformAdmin, Profile

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth import GoTrue

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class NewPlatformAdmin:
    id: UUID
    email: str


async def create_platform_admin(
    session: AsyncSession, gotrue: GoTrue, *, email: str, password: str, full_name: str
) -> NewPlatformAdmin:
    """Make the operator account an environment is run from.

    Deliberately not an endpoint: the first Platform admin has nobody to authorise them, so this
    is reached by `scripts/create_platform_admin.py` against a target environment instead. The
    address is confirmed on the spot — there is no portal to send a confirmation link to yet.

    Raises the `GoTrueError` the identity provider gave (an address already registered, a password
    it refused), so the caller can say so in the words its own surface uses.
    """
    user = await gotrue.create_user(email=email, password=password, confirmed=True)
    async with identity_undone_on_failure(gotrue, user.id), transaction(session):
        session.add(
            Profile(id=user.id, account_type=AccountType.PLATFORM_ADMIN, full_name=full_name)
        )
        await session.flush()
        session.add(PlatformAdmin(id=user.id))

    logger.info("platform.admin_created", profile_id=str(user.id))
    return NewPlatformAdmin(id=user.id, email=user.email)
