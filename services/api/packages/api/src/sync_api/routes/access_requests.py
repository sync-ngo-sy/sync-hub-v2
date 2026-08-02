from __future__ import annotations

from typing import Final

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, EmailStr, Field

from sync_api.dependencies import AccessRequestServiceDep
from sync_api.errors import openapi_problem
from sync_api.rate_limit import enforce_access_request_rate_limit
from sync_api.text import Line

ROUTER_PREFIX: Final = "/access-requests"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["access requests"])


class AskForAccessRequest(BaseModel):
    company: Line = Field(description="The company that wants Sync.")
    full_name: Line = Field(description="Who is asking.")
    email: EmailStr = Field(description="Where Sync answers them.")


@router.post(
    "",
    operation_id="askForAccess",
    summary="Ask for access to Sync",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
    dependencies=[Depends(enforce_access_request_rate_limit)],
    responses={429: openapi_problem("Too many requests from this address.")},
)
async def ask_for_access(
    body: AskForAccessRequest, access_requests: AccessRequestServiceDep
) -> Response:
    """Sync is sold, not self-served: this asks a human to open a Tenant, and creates nothing.

    Accepted rather than created, and answered with nothing: what a stranger asked for is not
    theirs to read back, and a second ask from the same address revises the first rather than
    queueing another — which the answer deliberately does not disclose either.
    """
    await access_requests.submit(company=body.company, full_name=body.full_name, email=body.email)
    return Response(status_code=status.HTTP_202_ACCEPTED)
