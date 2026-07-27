from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from sync_api.auth.gotrue import EmailAlreadyRegisteredError
from sync_api.auth.registration import (
    create_identity,
    email_already_registered,
    identity_undone_on_failure,
    undo_identity,
)
from sync_api.integrity import violated_constraint
from sync_api.problems import (
    LAST_TENANT_ADMIN_PROBLEM_TYPE,
    MEMBER_NOT_FOUND_PROBLEM_TYPE,
    TENANT_SLUG_TAKEN_PROBLEM_TYPE,
    Problem,
)
from sync_api.tenants.access import TenantSummary
from sync_core import get_logger, transaction
from sync_core.models import AccountType, Profile, Recruiter, RecruiterRole, Tenant, User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueUser

logger = get_logger(__name__)

TENANT_SLUG_CONSTRAINT: Final = "tenants_slug_key"
PROFILE_CONSTRAINT: Final = "profiles_pkey"


@dataclass(frozen=True, slots=True)
class Member:
    id: UUID
    full_name: str
    email: str
    role: RecruiterRole
    is_active: bool


@dataclass(frozen=True, slots=True)
class NewTenant:
    tenant: TenantSummary
    admin: Member


class TenantService:
    def __init__(self, session: AsyncSession, gotrue: GoTrue, *, invite_redirect_url: str) -> None:
        self._db = session
        self._gotrue = gotrue
        self._invite_redirect_url = invite_redirect_url

    async def sign_up(
        self, *, tenant_name: str, slug: str, email: str, password: str, full_name: str
    ) -> NewTenant:
        user = await create_identity(self._gotrue, email=email, password=password)
        async with identity_undone_on_failure(self._gotrue, user.id):
            tenant = await self._provision_tenant(
                user, tenant_name=tenant_name, slug=slug, full_name=full_name
            )
            await self._gotrue.send_confirmation_email(email)

        logger.info("tenants.signed_up", tenant_id=str(tenant.id), profile_id=str(user.id))
        return NewTenant(
            tenant=tenant,
            admin=Member(
                id=user.id,
                full_name=full_name,
                email=user.email,
                role=RecruiterRole.ADMIN,
                is_active=True,
            ),
        )

    async def members(self, tenant_id: UUID) -> list[Member]:
        rows = await self._db.execute(
            MEMBER_QUERY.where(Recruiter.tenant_id == tenant_id).order_by(Profile.full_name)
        )
        return [_member_from(row) for row in rows.tuples()]

    async def invite(
        self, *, tenant_id: UUID, email: str, full_name: str, role: RecruiterRole
    ) -> Member:
        if await self._address_is_taken(email):
            raise email_already_registered()

        try:
            user = await self._gotrue.invite_user(
                email=email, redirect_to=self._invite_redirect_url
            )
        except EmailAlreadyRegisteredError as exc:
            raise email_already_registered() from exc

        try:
            async with transaction(self._db):
                self._db.add(
                    Profile(id=user.id, account_type=AccountType.RECRUITER, full_name=full_name)
                )
                await self._db.flush()
                self._db.add(Recruiter(id=user.id, tenant_id=tenant_id, role=role))
        except BaseException as exc:
            if _is_already_provisioned(exc):
                raise email_already_registered() from exc
            await undo_identity(self._gotrue, user.id)
            raise

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

    async def _provision_tenant(
        self, user: GoTrueUser, *, tenant_name: str, slug: str, full_name: str
    ) -> TenantSummary:
        tenant = Tenant(name=tenant_name, slug=slug)
        try:
            async with transaction(self._db):
                self._db.add(tenant)
                await self._db.flush()
                self._db.add(
                    Profile(id=user.id, account_type=AccountType.RECRUITER, full_name=full_name)
                )
                await self._db.flush()
                self._db.add(Recruiter(id=user.id, tenant_id=tenant.id, role=RecruiterRole.ADMIN))
        except IntegrityError as exc:
            if violated_constraint(exc) != TENANT_SLUG_CONSTRAINT:
                raise
            raise Problem(
                status=409,
                type=TENANT_SLUG_TAKEN_PROBLEM_TYPE,
                detail=f"The address “{slug}” is already taken. Choose another.",
            ) from exc
        return TenantSummary(id=tenant.id, name=tenant.name, slug=tenant.slug)

    async def _address_is_taken(self, email: str) -> bool:
        found = await self._db.scalar(
            select(User.id).where(func.lower(User.email) == email.lower())
        )
        return found is not None

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


def _is_already_provisioned(exc: BaseException) -> bool:
    return isinstance(exc, IntegrityError) and violated_constraint(exc) == PROFILE_CONSTRAINT
