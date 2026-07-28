from __future__ import annotations

from typing import Annotated, Final
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from sync_api.crm import PooledCandidate, TalentPoolPage
from sync_api.dependencies import ActingRecruiterDep, TalentPoolServiceDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.routes.tenant_candidates import CANDIDATE_OUT_OF_REACH
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/tenants/me/talent-pool"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["talent pool"])


@router.get(
    "",
    operation_id="listTalentPool",
    summary="The Tenant's talent pool, most recently saved first",
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_talent_pool(
    recruiter: ActingRecruiterDep,
    pool: TalentPoolServiceDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> TalentPoolPage:
    """One pool per Tenant, and this is it. Names and headlines are read live, not frozen."""
    return await pool.page(recruiter, cursor=cursor, limit=limit)


@router.put(
    "/{candidate_id}",
    operation_id="saveCandidateToTalentPool",
    summary="Save a Candidate to the Tenant's talent pool",
    responses={**TENANT_ACCESS_REFUSED, **CANDIDATE_OUT_OF_REACH},
)
async def save_candidate_to_talent_pool(
    candidate_id: UUID, recruiter: ActingRecruiterDep, pool: TalentPoolServiceDep
) -> PooledCandidate:
    """Idempotent: saving them again keeps the entry, and the day it was first made."""
    return await pool.save(recruiter, candidate_id)


@router.delete(
    "/{candidate_id}",
    operation_id="dropCandidateFromTalentPool",
    summary="Take a Candidate out of the Tenant's talent pool",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**TENANT_ACCESS_REFUSED, **CANDIDATE_OUT_OF_REACH},
)
async def drop_candidate_from_talent_pool(
    candidate_id: UUID, recruiter: ActingRecruiterDep, pool: TalentPoolServiceDep
) -> Response:
    """Idempotent: a Candidate who was never in the pool is not an error."""
    await pool.drop(recruiter, candidate_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
