from __future__ import annotations

from typing import Any, Final
from uuid import UUID

from fastapi import APIRouter, Response, status

from sync_api.dependencies import ActingRecruiterDep, MessageTemplateServiceDep
from sync_api.errors import openapi_problem
from sync_api.messaging import MessageTemplate, MessageTemplateChanges, NewMessageTemplate
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/tenants/me/message-templates"

TEMPLATE_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no message template with that id."),
}

NAME_TAKEN: Final[dict[int | str, dict[str, Any]]] = {
    409: openapi_problem("The Tenant already has a Message template of that name."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["message-templates"])


@router.post(
    "",
    operation_id="createMessageTemplate",
    summary="Save a Message template",
    status_code=status.HTTP_201_CREATED,
    responses={**TENANT_ACCESS_REFUSED, **NAME_TAKEN},
)
async def create_message_template(
    body: NewMessageTemplate, recruiter: ActingRecruiterDep, templates: MessageTemplateServiceDep
) -> MessageTemplate:
    """The template is the Tenant's, and any of its recruiters may send from or rewrite it.

    A `{{ … }}` naming anything the platform cannot fill is refused here rather than at send
    time, so a template that saves always sends.
    """
    return await templates.create(recruiter, body)


@router.get(
    "",
    operation_id="listMessageTemplates",
    summary="Every Message template of the Tenant",
    responses=TENANT_ACCESS_REFUSED,
)
async def list_message_templates(
    recruiter: ActingRecruiterDep, templates: MessageTemplateServiceDep
) -> list[MessageTemplate]:
    """By name — a Tenant keeps few enough of these that they do not page."""
    return await templates.templates(recruiter)


@router.get(
    "/{template_id}",
    operation_id="getMessageTemplate",
    summary="One Message template, whole",
    responses={**TENANT_ACCESS_REFUSED, **TEMPLATE_NOT_FOUND},
)
async def get_message_template(
    template_id: UUID, recruiter: ActingRecruiterDep, templates: MessageTemplateServiceDep
) -> MessageTemplate:
    """The unresolved words, placeholders and all — what an editor opens."""
    return await templates.template(recruiter, template_id)


@router.put(
    "/{template_id}",
    operation_id="reviseMessageTemplate",
    summary="Rewrite a Message template",
    responses={**TENANT_ACCESS_REFUSED, **TEMPLATE_NOT_FOUND, **NAME_TAKEN},
)
async def revise_message_template(
    template_id: UUID,
    body: MessageTemplateChanges,
    recruiter: ActingRecruiterDep,
    templates: MessageTemplateServiceDep,
) -> MessageTemplate:
    """All of it at once, and the last write wins. Messages already sent from it keep the words
    they were sent with."""
    return await templates.revise(recruiter, template_id, body)


@router.delete(
    "/{template_id}",
    operation_id="deleteMessageTemplate",
    summary="Delete a Message template",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**TENANT_ACCESS_REFUSED, **TEMPLATE_NOT_FOUND},
)
async def delete_message_template(
    template_id: UUID, recruiter: ActingRecruiterDep, templates: MessageTemplateServiceDep
) -> Response:
    """Nothing sent from it is affected: each Communication carries its own resolved words."""
    await templates.remove(recruiter, template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
