from __future__ import annotations

from typing import Annotated, Final
from uuid import UUID

from fastapi import APIRouter, Query, Response, status
from pydantic import BeforeValidator

from sync_api.crm import PooledCandidate, TalentPoolOrder, TalentPoolPage
from sync_api.dependencies import ActingRecruiterDep, TalentPoolServiceDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.routes.tenant_candidates import CANDIDATE_OUT_OF_REACH
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED
from sync_api.text import without_control_characters
from sync_core.profile import MAX_LINE_LENGTH

ROUTER_PREFIX: Final = "/tenants/me/talent-pool"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["talent pool"])


@router.get(
    "",
    operation_id="listTalentPool",
    summary="The Tenant's talent pool, in the order you ask for",
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_talent_pool(
    recruiter: ActingRecruiterDep,
    pool: TalentPoolServiceDep,
    q: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description="Keeps only the people whose name or headline holds this, wherever in it "
            "and whatever the case. It narrows the pool; it never reaches outside it.",
            examples=["haddad"],
        ),
        BeforeValidator(without_control_characters),
    ] = None,
    sort: Annotated[
        TalentPoolOrder,
        Query(
            description="What order to answer in. Most recently saved first unless you say "
            "otherwise, and a `cursor` only ever resumes the order it was issued for."
        ),
    ] = TalentPoolOrder.NEWEST,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the first page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> TalentPoolPage:
    """One pool per Tenant, and this is it.

    Everything a row says about a Candidate — their name, their headline, the role they put
    themselves under, their years of work, their photo — is read live rather than frozen the day
    they were saved. The Tags are this Tenant's own filing of them, and nobody else's.
    """
    return await pool.page(recruiter, wanted=q, order=sort, cursor=cursor, limit=limit)


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
