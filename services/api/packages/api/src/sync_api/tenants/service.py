from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, select

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
