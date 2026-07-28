from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from sync_api.crm import NewTag, Tag, TagChanges
from sync_api.dependencies import ActingRecruiterDep, TagServiceDep
from sync_api.errors import openapi_problem
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED
from sync_core.models import TagScope

ROUTER_PREFIX: Final = "/tenants/me/tags"

TAG_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no tag with that id."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["tags"])


@router.post(
    "",
    operation_id="createTenantTag",
    summary="Add a Tag to the Tenant's vocabulary",
    status_code=status.HTTP_201_CREATED,
    responses={
        **TENANT_ACCESS_REFUSED,
        409: openapi_problem("The Tenant already has a Tag of that name in that scope."),
    },
)
async def create_tenant_tag(
    body: NewTag, recruiter: ActingRecruiterDep, tags: TagServiceDep
) -> Tag:
    """A Tag is the Tenant's alone, and its `scope` fixes what it may be put on."""
    return await tags.create(recruiter, body)


@router.get(
    "",
    operation_id="listTenantTags",
    summary="Every Tag of the Tenant",
    responses=TENANT_ACCESS_REFUSED,
)
async def list_tenant_tags(
    recruiter: ActingRecruiterDep,
    tags: TagServiceDep,
    scope: Annotated[
        TagScope | None, Query(description="Only Tags of this scope. Omit for all of them.")
    ] = None,
) -> list[Tag]:
    """The whole vocabulary, by scope then name — short enough that it does not page."""
    return await tags.tags(recruiter, scope=scope)


@router.patch(
    "/{tag_id}",
    operation_id="renameTenantTag",
    summary="Rename a Tag",
    responses={
        **TENANT_ACCESS_REFUSED,
        **TAG_NOT_FOUND,
        409: openapi_problem("The Tenant already has a Tag of that name in that scope."),
    },
)
async def rename_tenant_tag(
    tag_id: UUID, body: TagChanges, recruiter: ActingRecruiterDep, tags: TagServiceDep
) -> Tag:
    """Everything already filed under it stays filed: the Tag keeps its id and its scope."""
    return await tags.rename(recruiter, tag_id, body)


@router.delete(
    "/{tag_id}",
    operation_id="deleteTenantTag",
    summary="Delete a Tag",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**TENANT_ACCESS_REFUSED, **TAG_NOT_FOUND},
)
async def delete_tenant_tag(
    tag_id: UUID, recruiter: ActingRecruiterDep, tags: TagServiceDep
) -> Response:
    """Unfiles it from every Candidate and Application it was on, which is what deleting means."""
    await tags.remove(recruiter, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
