from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from tests.support.applications import TENANT_APPLICATIONS

if TYPE_CHECKING:
    from httpx import AsyncClient, Response

TENANT_MESSAGE_TEMPLATES: Final = "/v1/tenants/me/message-templates"

MESSAGE_TEMPLATE_NAME_TAKEN: Final = "urn:sync:problem:message-template-name-taken"
MESSAGE_TEMPLATE_NOT_FOUND: Final = "urn:sync:problem:message-template-not-found"
VALIDATION_ERROR: Final = "urn:sync:problem:validation-error"

A_TEMPLATE: Final[dict[str, Any]] = {
    "name": "Interview invitation",
    "subject": "An interview for {{ job_title }}?",
    "body": "Hi {{ candidate_name }},\n\nWe would like to meet you.\n\n{{ tenant_name }}",
}


def a_template(**changes: Any) -> dict[str, Any]:
    return {**A_TEMPLATE, **changes}


async def create_template(recruiter: AsyncClient, **changes: Any) -> Response:
    return await recruiter.post(TENANT_MESSAGE_TEMPLATES, json=a_template(**changes))


async def a_saved_template(recruiter: AsyncClient, **changes: Any) -> dict[str, Any]:
    response = await create_template(recruiter, **changes)
    assert response.status_code == 201, response.text
    saved: dict[str, Any] = response.json()
    return saved


async def list_templates(recruiter: AsyncClient) -> Response:
    return await recruiter.get(TENANT_MESSAGE_TEMPLATES)


async def templates_of(recruiter: AsyncClient) -> list[dict[str, Any]]:
    response = await list_templates(recruiter)
    assert response.status_code == 200, response.text
    templates: list[dict[str, Any]] = response.json()
    return templates


async def read_template(recruiter: AsyncClient, template_id: str | UUID) -> Response:
    return await recruiter.get(f"{TENANT_MESSAGE_TEMPLATES}/{template_id}")


async def revise_template(
    recruiter: AsyncClient, template_id: str | UUID, **changes: Any
) -> Response:
    return await recruiter.put(
        f"{TENANT_MESSAGE_TEMPLATES}/{template_id}", json=a_template(**changes)
    )


async def delete_template(recruiter: AsyncClient, template_id: str | UUID) -> Response:
    return await recruiter.delete(f"{TENANT_MESSAGE_TEMPLATES}/{template_id}")


def messages_to(application_id: str | UUID) -> str:
    return f"{TENANT_APPLICATIONS}/{application_id}/messages"


async def send_message(
    recruiter: AsyncClient,
    application_id: str | UUID,
    template_id: str | UUID,
    edited: dict[str, Any] | None = None,
) -> Response:
    return await recruiter.post(
        messages_to(application_id), json={"template_id": str(template_id), "edited": edited}
    )


async def a_sent_message(
    recruiter: AsyncClient,
    application_id: str | UUID,
    template_id: str | UUID,
    edited: dict[str, Any] | None = None,
) -> dict[str, Any]:
    response = await send_message(recruiter, application_id, template_id, edited)
    assert response.status_code == 201, response.text
    sent: dict[str, Any] = response.json()
    return sent
