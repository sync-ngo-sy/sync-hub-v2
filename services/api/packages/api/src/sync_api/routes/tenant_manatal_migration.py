from __future__ import annotations

from typing import Final

from fastapi import APIRouter

from sync_api.dependencies import ManatalMigrationServiceDep, TenantAdminDep
from sync_api.errors import openapi_problem
from sync_api.manatal import ManatalMigrationStatus

ROUTER_PREFIX: Final = "/tenants/me/manatal-migration"

TENANT_ADMIN_REFUSED: Final = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem(
        "The caller is not a tenant admin, has been deactivated, or their tenant is suspended."
    ),
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
    """Counts and recent rows for candidates this Tenant brought across from Manatal.

    The import itself still runs as `scripts/manatal-migration` against the environment; this
    read is what a tenant admin checks while that work is going on, and afterwards.
    """
    return await migration.status(recruiter)
