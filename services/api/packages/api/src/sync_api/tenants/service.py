from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select

from sync_api.auth.registration import identity_undone_unless_taken, invite_identity
from sync_api.problems import (
    LAST_TENANT_ADMIN_PROBLEM_TYPE,
    MEMBER_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger, transaction
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueUser

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Member:
    id: UUID
    full_name: str
    email: str
    role: RecruiterRole
    is_active: bool

    @classmethod
    def founding(cls, user: GoTrueUser, full_name: str) -> Member:
        """The admin a Tenant was just opened with — active, and alone on the roster."""
        return cls(
            id=user.id,
            full_name=full_name,
            email=user.email,
            role=RecruiterRole.ADMIN,
            is_active=True,
        )


class TenantService:
    """What a Tenant's own admins do to their roster. Opening a Tenant is not here: only a
    Platform admin does that, from an Access request."""

    def __init__(self, session: AsyncSession, gotrue: GoTrue, *, recruiter_portal_url: str) -> None:
        self._db = session
        self._gotrue = gotrue
        self._recruiter_portal_url = recruiter_portal_url

    async def members(self, tenant_id: UUID) -> list[Member]:
        rows = await self._db.execute(
            MEMBER_QUERY.where(Recruiter.tenant_id == tenant_id).order_by(Profile.full_name)
        )
        return [_member_from(row) for row in rows.tuples()]

    async def invite(
        self, *, tenant_id: UUID, email: str, full_name: str, role: RecruiterRole
    ) -> Member:
        user = await invite_identity(
            self._gotrue, self._db, email=email, redirect_to=self._recruiter_portal_url
        )
        async with (
            identity_undone_unless_taken(self._gotrue, user.id),
            transaction(self._db),
        ):
            self._db.add(
                Profile(id=user.id, account_type=AccountType.RECRUITER, full_name=full_name)
            )
            await self._db.flush()
            self._db.add(Recruiter(id=user.id, tenant_id=tenant_id, role=role))

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
        async with transaction(self._db):
            await self._lock_the_admins(tenant_id)
            recruiter = await self._db.get(Recruiter, recruiter_id)
            if recruiter is None or recruiter.tenant_id != tenant_id:
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

    async def _lock_the_admins(self, tenant_id: UUID) -> None:
        """Take the whole admin set before the roster is measured.

        The check below asks whether any of these rows is left, and a transaction holding only the
        row it is changing reads the admin somebody else is removing at that same moment as still
        active. Two admins deactivated at once then both pass, and the Tenant is left with none —
        which it cannot recover from on its own, because every route that could appoint an admin
        needs an active admin to call it, and no platform operation reaches a Tenant's roster
        either.

        Ordered by id, so two of these queue up behind each other instead of deadlocking.
        """
        await self._db.execute(
            ACTIVE_ADMINS.where(Recruiter.tenant_id == tenant_id)
            .order_by(Recruiter.id)
            .with_for_update()
        )

    async def _has_an_active_admin(self, tenant_id: UUID) -> bool:
        found = await self._db.scalar(
            ACTIVE_ADMINS.where(Recruiter.tenant_id == tenant_id).limit(1)
        )
        return found is not None

    async def _member(self, recruiter_id: UUID) -> Member:
        rows = await self._db.execute(MEMBER_QUERY.where(Recruiter.id == recruiter_id))
        return _member_from(rows.tuples().one())


MEMBER_QUERY = (
    select(Recruiter.id, Profile.full_name, User.email, Recruiter.role, Recruiter.is_active)
    .join(Profile, Profile.id == Recruiter.id)
    .join(User, User.id == Recruiter.id)
)

#: One query for both halves of the invariant: the rows the check reads are exactly the rows
#: locked before it, which is the only reason the check means anything under concurrency.
ACTIVE_ADMINS = select(Recruiter.id).where(
    Recruiter.role == RecruiterRole.ADMIN, Recruiter.is_active.is_(True)
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
