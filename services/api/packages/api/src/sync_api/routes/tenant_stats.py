from __future__ import annotations

from typing import Final

from fastapi import APIRouter

from sync_api.dependencies import ActingRecruiterDep, StatsServiceDep
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED
from sync_api.stats import TenantStats

ROUTER_PREFIX: Final = "/tenants/me/stats"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["stats"])


@router.get(
    "",
    operation_id="getTenantStats",
    summary="Everything the Dashboard counts",
    responses=TENANT_ACCESS_REFUSED,
)
async def get_tenant_stats(recruiter: ActingRecruiterDep, stats: StatsServiceDep) -> TenantStats:
    """The tenant's Jobs, its Applications and where its Job views came from, counted whole.

    Every window is rolling: `last_7d` is the last 168 hours rather than this week so far. The
    counts span every Job whatever state it is in, and every Application whatever stage it has
    reached — a rejected Application was still received, so it is still counted as one.
    """
    return await stats.counts(recruiter)
