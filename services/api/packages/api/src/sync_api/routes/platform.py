from __future__ import annotations

from datetime import datetime
from typing import Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, Field

from sync_api.access_requests import AccessRequest
from sync_api.dependencies import (
    AccessRequestServiceDep,
    PlatformServiceDep,
    get_acting_platform_admin,
)
from sync_api.errors import openapi_problem
from sync_api.platform import CreatedTenant, PlatformCounts, TenantRecord
from sync_api.routes.auth import IDENTITY_PROVIDER_UNAVAILABLE
from sync_api.routes.tenants import FullName, MemberView, Slug
from sync_core.models import TenantPlan

ROUTER_PREFIX: Final = "/platform"

PLATFORM_ACCESS_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem("The caller is not a platform admin."),
}

#: Nothing under this prefix is reachable by anyone else, so the guard is stated once.
router = APIRouter(
    prefix=ROUTER_PREFIX, tags=["platform"], dependencies=[Depends(get_acting_platform_admin)]
)


class PlatformTenantView(BaseModel):
    """A Tenant as the operator running the platform sees it."""

    id: str
    name: str
    slug: str = Field(description="The tenant's address, unique across the platform.")
    plan: TenantPlan = Field(description="Reported only — nothing on the platform reads it yet.")
    member_count: int = Field(description="Every recruiter on the roster, deactivated ones too.")
    is_active: bool = Field(description="False while the tenant is suspended.")
    invite_pending: bool = Field(
        description="True while the founding admin has not yet accepted their invitation."
    )

    @classmethod
    def of(cls, tenant: TenantRecord) -> PlatformTenantView:
        return cls(
            id=str(tenant.id),
            name=tenant.name,
            slug=tenant.slug,
            plan=tenant.plan,
            member_count=tenant.member_count,
            is_active=tenant.is_active,
            invite_pending=tenant.invite_pending,
        )


class CreatedTenantView(BaseModel):
    """What opening a tenant produced: the tenant, and the admin now holding an invitation."""

    tenant: PlatformTenantView
    founding_admin: MemberView

    @classmethod
    def of(cls, created: CreatedTenant) -> CreatedTenantView:
        return cls(
            tenant=PlatformTenantView.of(created.tenant),
            founding_admin=MemberView.of(created.founding_admin),
        )


class CreateTenantRequest(BaseModel):
    name: FullName = Field(description="The hiring company's display name.")
    slug: Slug
    email: EmailStr = Field(
        description="The founding admin's address. They are invited, not given a password."
    )
    full_name: FullName = Field(description="The founding admin's name.")


class PlatformOverviewView(BaseModel):
    """The whole platform in four numbers."""

    tenants: int
    candidates: int
    jobs: int
    applications: int

    @classmethod
    def of(cls, counts: PlatformCounts) -> PlatformOverviewView:
        return cls(
            tenants=counts.tenants,
            candidates=counts.candidates,
            jobs=counts.jobs,
            applications=counts.applications,
        )


class SetTenantStatusRequest(BaseModel):
    is_active: bool = Field(description="False suspends the tenant; True restores it.")


class AccessRequestView(BaseModel):
    """A company waiting to be let onto Sync, exactly as its visitor typed it."""

    id: str
    company: str
    full_name: str = Field(description="Who asked, and who the founding admin would be.")
    email: EmailStr
    created_at: datetime = Field(description="When they asked. The queue runs oldest first.")

    @classmethod
    def of(cls, request: AccessRequest) -> AccessRequestView:
        return cls(
            id=str(request.id),
            company=request.company,
            full_name=request.full_name,
            email=request.email,
            created_at=request.created_at,
        )


class ConvertAccessRequest(BaseModel):
    """The tenant's address — the one thing the visitor could not tell us, because it is ours
    to hand out. Everything else the Tenant is made of comes off the request itself."""

    slug: Slug


ACCESS_REQUEST_UNDECIDABLE: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("No access request with that id."),
    409: openapi_problem("That access request has already been converted or dismissed."),
}


@router.get(
    "/tenants",
    operation_id="listPlatformTenants",
    summary="Every tenant on the platform",
    responses=PLATFORM_ACCESS_REFUSED,
)
async def list_platform_tenants(platform: PlatformServiceDep) -> list[PlatformTenantView]:
    """The whole customer list, suspended tenants included."""
    tenants = await platform.tenants()
    return [PlatformTenantView.of(tenant) for tenant in tenants]


@router.post(
    "/tenants",
    operation_id="createPlatformTenant",
    summary="Open a tenant and invite its founding admin",
    status_code=status.HTTP_201_CREATED,
    responses={
        **PLATFORM_ACCESS_REFUSED,
        409: openapi_problem("The slug or the email address is already taken."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def create_platform_tenant(
    body: CreateTenantRequest, platform: PlatformServiceDep
) -> CreatedTenantView:
    """One operation: the tenant exists and its founding admin has been mailed an invitation."""
    return CreatedTenantView.of(
        await platform.create_tenant(
            name=body.name, slug=body.slug, email=body.email, full_name=body.full_name
        )
    )


@router.post(
    "/tenants/{tenant_id}/invite",
    operation_id="resendFoundingAdminInvite",
    summary="Mail the founding admin their invitation again",
    responses={
        **PLATFORM_ACCESS_REFUSED,
        404: openapi_problem("No tenant with that id."),
        409: openapi_problem("The founding admin has already accepted."),
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def resend_founding_admin_invite(tenant_id: UUID, platform: PlatformServiceDep) -> MemberView:
    """For the invitation that expired, or never arrived. The fresh link supersedes the old one."""
    return MemberView.of(await platform.resend_invite(tenant_id))


@router.patch(
    "/tenants/{tenant_id}",
    operation_id="setPlatformTenantStatus",
    summary="Suspend a tenant or restore it",
    responses={
        **PLATFORM_ACCESS_REFUSED,
        404: openapi_problem("No tenant with that id."),
    },
)
async def set_platform_tenant_status(
    tenant_id: UUID, body: SetTenantStatusRequest, platform: PlatformServiceDep
) -> PlatformTenantView:
    """Suspending turns every recruiter of the tenant away; restoring gives them back what
    they had. Nothing is deleted either way."""
    return PlatformTenantView.of(
        await platform.set_tenant_status(tenant_id, is_active=body.is_active)
    )


@router.get(
    "/access-requests",
    operation_id="listAccessRequests",
    summary="Companies waiting to be let onto Sync",
    responses=PLATFORM_ACCESS_REFUSED,
)
async def list_access_requests(
    access_requests: AccessRequestServiceDep,
) -> list[AccessRequestView]:
    """The queue, oldest first. A request leaves it the moment it is converted or dismissed."""
    pending = await access_requests.pending()
    return [AccessRequestView.of(request) for request in pending]


@router.post(
    "/access-requests/{request_id}/tenant",
    operation_id="convertAccessRequest",
    summary="Turn a request into a tenant",
    status_code=status.HTTP_201_CREATED,
    responses={
        **PLATFORM_ACCESS_REFUSED,
        **ACCESS_REQUEST_UNDECIDABLE,
        **IDENTITY_PROVIDER_UNAVAILABLE,
    },
)
async def convert_access_request(
    request_id: UUID, body: ConvertAccessRequest, access_requests: AccessRequestServiceDep
) -> CreatedTenantView:
    """Same operation as opening a tenant by hand, with nothing retyped: the company, the
    founding admin and their address all come off the request, which then leaves the queue.

    A taken slug or an address that already has an account is refused the way it always is, and
    the request stays pending — so a mistyped address is one correction away, not a lost ask.
    """
    return CreatedTenantView.of(await access_requests.convert(request_id, slug=body.slug))


@router.post(
    "/access-requests/{request_id}/dismissal",
    operation_id="dismissAccessRequest",
    summary="Take a request off the queue",
    responses={**PLATFORM_ACCESS_REFUSED, **ACCESS_REQUEST_UNDECIDABLE},
)
async def dismiss_access_request(
    request_id: UUID, access_requests: AccessRequestServiceDep
) -> AccessRequestView:
    """Nothing is opened and nothing is emailed. The row stays, so the same company asking
    again reads as a second ask rather than a first one."""
    return AccessRequestView.of(await access_requests.dismiss(request_id))


@router.get(
    "/overview",
    operation_id="getPlatformOverview",
    summary="Platform-wide counts",
    responses=PLATFORM_ACCESS_REFUSED,
)
async def get_platform_overview(platform: PlatformServiceDep) -> PlatformOverviewView:
    """How big the platform is. Deleted candidates are counted out."""
    return PlatformOverviewView.of(await platform.counts())
