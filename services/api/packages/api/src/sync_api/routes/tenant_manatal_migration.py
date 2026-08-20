from __future__ import annotations

from typing import Final

from fastapi import APIRouter

from sync_api.dependencies import (
    ManatalMigrationServiceDep,
    ManatalMigrationStartServiceDep,
    TenantAdminDep,
)
from sync_api.errors import openapi_problem
from sync_api.manatal import ManatalMigrationStatus
from sync_api.manatal.payload import ManatalMigrationStartRequest, ManatalMigrationStartResponse

ROUTER_PREFIX: Final = "/tenants/me/manatal-migration"

TENANT_ADMIN_REFUSED: Final = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem(
        "The caller is not a tenant admin, has been deactivated, or their tenant is suspended."
    ),
}

MANATAL_START_REFUSED: Final = {
    **TENANT_ADMIN_REFUSED,
    503: openapi_problem("Manatal import is not configured in this environment."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["integrations"])


@router.get(
    "",
    operation_id="getManatalMigrationStatus",
    summary="How far the Manatal import has got",
    responses=TENANT_ADMIN_REFUSED,
)
async def get_manatal_migration_status(
    recruiter: TenantAdminDep, migration: ManatalMigrationServiceDep
) -> ManatalMigrationStatus:
    """Counts, queue state, and recent rows for candidates this Tenant brought across from Manatal."""
    return await migration.status(recruiter)


@router.post(
    "/start",
    operation_id="startManatalMigration",
    summary="Start or continue a Manatal import batch",
    responses=MANATAL_START_REFUSED,
)
async def start_manatal_migration(
    recruiter: TenantAdminDep,
    body: ManatalMigrationStartRequest,
    migration: ManatalMigrationStartServiceDep,
) -> ManatalMigrationStartResponse:
    """Enqueue worker jobs to import from Manatal or publish parsed profiles."""
    return await migration.start(recruiter, body.action)
