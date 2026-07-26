"""Inviting teammates and managing their roles and activation.

Every route here depends on `ActingRecruiterDep`, which is what actually enforces the
ticket's kill-switch and per-Recruiter deactivation (`sync_api.tenants.TenantService`
docstring) — a route that reaches this module already knows the caller is an active
Recruiter in an active Tenant, and only checks its own admin-only requirement on top.
"""

from __future__ import annotations

from typing import Final
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, EmailStr, Field

from sync_api.dependencies import ActingRecruiterDep, TenantServiceDep
from sync_api.errors import openapi_problem
from sync_api.tenants import RecruiterSummary
from sync_core.models import RecruiterRole

ROUTER_PREFIX: Final = "/tenants"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["tenants"])

#: Every mutating route here can answer with these regardless of what else it can fail with.
TENANT_SCOPE_RESPONSES: Final[dict[int | str, dict[str, object]]] = {
    403: openapi_problem(
        "The caller is not a Recruiter, is deactivated, their Tenant is deactivated, or the "
        "action needs the admin role."
    ),
}


class RecruiterView(BaseModel):
    """A teammate, as the tenant-management routes report them."""

    id: str
    email: EmailStr
    full_name: str
    role: RecruiterRole
    is_active: bool

    @classmethod
    def of(cls, summary: RecruiterSummary) -> RecruiterView:
        return cls(
            id=str(summary.id),
            email=summary.email,
            full_name=summary.full_name,
            role=summary.role,
            is_active=summary.is_active,
        )


class InviteRecruiterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: RecruiterRole = RecruiterRole.RECRUITER


class UpdateRecruiterRequest(BaseModel):
    role: RecruiterRole | None = None
    is_active: bool | None = None


@router.get(
    "/recruiters",
    operation_id="listRecruiters",
    summary="List the caller's Tenant's Recruiters",
    responses=TENANT_SCOPE_RESPONSES,
)
async def list_recruiters(
    actor: ActingRecruiterDep, tenants: TenantServiceDep
) -> list[RecruiterView]:
    """Every teammate in the caller's own Tenant — how an admin finds a `recruiter_id` to
    invite, change, or deactivate once it is no longer sitting in an invite response."""
    return [RecruiterView.of(summary) for summary in await tenants.list_recruiters(actor)]


@router.post(
    "/recruiters",
    operation_id="inviteRecruiter",
    summary="Invite a teammate by email",
    status_code=status.HTTP_201_CREATED,
    responses={
        **TENANT_SCOPE_RESPONSES,
        409: openapi_problem("An account already exists for this email address."),
    },
)
async def invite_recruiter(
    body: InviteRecruiterRequest, actor: ActingRecruiterDep, tenants: TenantServiceDep
) -> RecruiterView:
    """Send the GoTrue invite email and provision the Profile and Recruiter immediately.

    The invitee lands in the Tenant the moment they set a password at `/auth/accept-invite`
    — there is nothing left to provision by then.
    """
    return RecruiterView.of(
        await tenants.invite_recruiter(
            actor, email=body.email, full_name=body.full_name, role=body.role
        )
    )


@router.patch(
    "/recruiters/{recruiter_id}",
    operation_id="updateRecruiter",
    summary="Change a teammate's role or activation",
    responses={
        **TENANT_SCOPE_RESPONSES,
        404: openapi_problem("No Recruiter with that id in the caller's Tenant."),
        409: openapi_problem("This would leave the Tenant with no active admin."),
    },
)
async def update_recruiter(
    recruiter_id: UUID,
    body: UpdateRecruiterRequest,
    actor: ActingRecruiterDep,
    tenants: TenantServiceDep,
) -> RecruiterView:
    """Deactivating a Recruiter (or demoting an admin) takes effect on their next request —
    it does not revoke a session already in flight."""
    return RecruiterView.of(
        await tenants.update_recruiter(
            actor, recruiter_id, role=body.role, is_active=body.is_active
        )
    )
