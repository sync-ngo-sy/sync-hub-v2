from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from pydantic import AfterValidator, BaseModel, EmailStr, Field

from sync_api.dependencies import (
    ActingRecruiterDep,
    TenantAdminDep,
    TenantLogoServiceDep,
    TenantServiceDep,
)
from sync_api.errors import openapi_problem
from sync_api.pictures import ACCEPTED_FORMATS
from sync_api.rate_limit import enforce_auth_rate_limit
from sync_api.routes.auth import IDENTITY_PROVIDER_UNAVAILABLE
from sync_api.tenants import Member, TenantLogo, TenantSummary
from sync_api.text import without_control_characters
from sync_core.models import RecruiterRole

ROUTER_PREFIX: Final = "/tenants"

SLUG_PATTERN: Final = r"^[a-z0-9]+(-[a-z0-9]+)*$"

TENANT_ACCESS_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem(
        "The caller is not a recruiter, has been deactivated, or their tenant is suspended."
    ),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["tenants"])

Slug = Annotated[
    str,
    Field(
        min_length=2,
        max_length=63,
        pattern=SLUG_PATTERN,
        description="Lowercase letters, digits and single hyphens.",
        examples=["acme-recruiting"],
    ),
]

FullName = Annotated[
    str,
    Field(min_length=1, max_length=200),
    AfterValidator(without_control_characters),
]


class TenantView(BaseModel):
    """A Tenant as its own recruiters see it."""

    id: str
    name: str
    slug: str
    logo_url: str | None = Field(
        default=None, description="The logo Candidates see, or null until an admin sets one."
    )

    @classmethod
    def of(cls, tenant: TenantSummary) -> TenantView:
        return cls(id=str(tenant.id), name=tenant.name, slug=tenant.slug, logo_url=tenant.logo_url)


class MemberView(BaseModel):
    """One Recruiter on the roster."""

    id: str = Field(description="Shared with the Supabase Auth user and the Profile.")
    full_name: str
    email: EmailStr
    role: RecruiterRole
    is_active: bool = Field(description="False once an admin has revoked their access.")

    @classmethod
    def of(cls, member: Member) -> MemberView:
        return cls(
            id=str(member.id),
            full_name=member.full_name,
            email=member.email,
            role=member.role,
            is_active=member.is_active,
        )


class InviteMemberRequest(BaseModel):
    email: EmailStr
    full_name: FullName
    role: RecruiterRole = RecruiterRole.RECRUITER


class ChangeMemberRequest(BaseModel):
    """Both fields optional: an admin changing a role should not have to restate access."""

    role: RecruiterRole | None = None
    is_active: bool | None = None


@router.get(
    "/me",
    operation_id="getMyTenant",
    summary="The tenant the caller recruits for",
    responses=TENANT_ACCESS_REFUSED,
)
async def get_my_tenant(recruiter: ActingRecruiterDep) -> TenantView:
    """Answers only while both kill-switches are off, which makes it the SPA's liveness check."""
    return TenantView.of(recruiter.tenant)


@router.get(
    "/me/members",
    operation_id="listTenantMembers",
    summary="The tenant's recruiters",
    responses=TENANT_ACCESS_REFUSED,
)
async def list_tenant_members(
    recruiter: ActingRecruiterDep, tenants: TenantServiceDep
) -> list[MemberView]:
    """Everyone on the roster, deactivated colleagues included. Any recruiter may read it."""
    members = await tenants.members(recruiter.tenant.id)
    return [MemberView.of(member) for member in members]


@router.post(
    "/me/members",
    operation_id="inviteTenantMember",
    summary="Invite a teammate",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_auth_rate_limit)],
    responses={
        **TENANT_ACCESS_REFUSED,
        409: openapi_problem("That email address already has a Sync Hub account."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def invite_tenant_member(
    body: InviteMemberRequest, admin: TenantAdminDep, tenants: TenantServiceDep
) -> MemberView:
    """Mail an invitation and add the invitee to the roster, pending their password."""
    member = await tenants.invite(
        tenant_id=admin.tenant.id, email=body.email, full_name=body.full_name, role=body.role
    )
    return MemberView.of(member)


@router.patch(
    "/me/members/{recruiter_id}",
    operation_id="changeTenantMember",
    summary="Change a teammate's role or access",
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem("No such member of this tenant."),
        409: openapi_problem("The change would leave the tenant with no active admin."),
    },
)
async def change_tenant_member(
    recruiter_id: UUID,
    body: ChangeMemberRequest,
    admin: TenantAdminDep,
    tenants: TenantServiceDep,
) -> MemberView:
    """Promote, demote, deactivate or reinstate a colleague. Deactivating keeps the row."""
    member = await tenants.change_member(
        tenant_id=admin.tenant.id,
        recruiter_id=recruiter_id,
        role=body.role,
        is_active=body.is_active,
    )
    return MemberView.of(member)


@router.put(
    "/me/logo",
    operation_id="replaceTenantLogo",
    summary="Set the Tenant's logo",
    responses={
        **TENANT_ACCESS_REFUSED,
        413: openapi_problem("The file is larger than the platform accepts."),
        415: openapi_problem(f"The file is not a {ACCEPTED_FORMATS} image."),
        422: openapi_problem("The file is empty."),
        502: openapi_problem("The file store could not be reached."),
    },
)
async def replace_tenant_logo(
    admin: TenantAdminDep,
    logos: TenantLogoServiceDep,
    file: Annotated[
        UploadFile,
        File(description=f"The logo: {ACCEPTED_FORMATS}. Square or it is cropped."),
    ],
) -> TenantLogo:
    """The mark Candidates identify this Tenant by, wherever one of its Jobs appears.

    Replaces whatever logo the Tenant had, at a new address — the old one stops answering.
    """
    return await logos.replace(admin.tenant.id, file)
