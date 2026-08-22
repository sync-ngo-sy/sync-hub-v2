from __future__ import annotations

from typing import Annotated, Final
from uuid import UUID

from fastapi import APIRouter, Query

from sync_api.applications import TenantHireClaimPage
from sync_api.dependencies import ActingRecruiterDep, HireClaimServiceDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED
from sync_core.models import HireConfirmation

ROUTER_PREFIX: Final = "/tenants/me/hire-claims"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["hire claims"])


@router.get(
    "",
    operation_id="listTenantHireClaims",
    summary="The hires the tenant has claimed, newest claim first",
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem(
            "`cursor` is not one this API issued, or belongs to another `confirmation`."
        ),
    },
)
async def list_tenant_hire_claims(
    recruiter: ActingRecruiterDep,
    hires: HireClaimServiceDep,
    confirmation: Annotated[
        HireConfirmation,
        Query(
            description="Which claims to answer with: the ones the Candidate confirmed, the "
            "ones nobody has answered, or the ones they denied."
        ),
    ] = HireConfirmation.CONFIRMED,
    job_id: Annotated[
        UUID | None,
        Query(
            description="Only claims made on this Job. Narrows `counts` as it narrows the list, "
            "so a tab never names a size its own list cannot show. A Job of another tenant "
            "narrows the list to nothing."
        ),
    ] = None,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the first page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> TenantHireClaimPage:
    """Every hire the tenant says it made, across every Job, one standing at a time.

    `confirmed` is the default and the only one of the three that is a Placement: it is read
    from the `placements` view, so this list and anything else counting Placements cannot
    disagree. The other two are read from the claims themselves.

    Nothing here lapses. An unanswered claim stays unanswered for as long as the Candidate
    leaves it, and `claimed_at` is what says how long that has been. A denial is recorded and
    announced to nobody.

    `counts` comes back whichever standing is being read, so the sizes of the other two are
    never hidden by the one on screen. `jobs` comes back whichever Job is being read, because it
    is what the Job filter offers and a picker narrowed by its own choice could not be unpicked.
    """
    return await hires.page(
        recruiter, confirmation=confirmation, job_id=job_id, cursor=cursor, limit=limit
    )
