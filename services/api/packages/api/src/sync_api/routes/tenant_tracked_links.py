from __future__ import annotations

from typing import Annotated, Final

from fastapi import APIRouter, Query

from sync_api.dependencies import ActingRecruiterDep, TrackedLinkServiceDep
from sync_api.errors import openapi_problem
from sync_api.jobs import TenantTrackedLinkPage
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/tenants/me/tracked-links"

SEARCH_LENGTH: Final = 200

router = APIRouter(prefix=ROUTER_PREFIX, tags=["jobs"])


@router.get(
    "",
    operation_id="listTenantTrackedLinks",
    summary="The tenant's Tracked links, newest first",
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_tenant_tracked_links(
    recruiter: ActingRecruiterDep,
    links: TrackedLinkServiceDep,
    q: Annotated[
        str | None,
        Query(
            max_length=SEARCH_LENGTH,
            description="Only links whose name contains this, ignoring case.",
        ),
    ] = None,
    is_active: Annotated[
        bool | None, Query(description="Only links that are on, or only those turned off.")
    ] = None,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> TenantTrackedLinkPage:
    """Every Tracked link of the tenant, across every Job, each naming the Job it points at.

    One row per link rather than per name: the same campaign run on nine Jobs is nine links,
    each with its own traffic and its own state. The Dashboard's `sources` merges them instead,
    which is a different question.

    A link that expired or was turned off stays in the list — it still brought the traffic it
    brought. `expires_at` is returned rather than filtered on, so telling live from expired is
    the caller's to do with a date it already has.
    """
    return await links.tenant_page(recruiter, q=q, is_active=is_active, cursor=cursor, limit=limit)
