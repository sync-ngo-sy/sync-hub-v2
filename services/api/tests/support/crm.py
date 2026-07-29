from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from tests.support.applications import (
    TENANT_APPLICATIONS,
    a_candidate_who_can_apply,
    an_accepted_application,
)
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import a_published_job
from tests.support.profiles import a_profile, give_a_current_cv, my_id

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

TENANT_TAGS: Final = "/v1/tenants/me/tags"
TENANT_CANDIDATES: Final = "/v1/tenants/me/candidates"
TALENT_POOL: Final = "/v1/tenants/me/talent-pool"
CANDIDATE_PROFILE: Final = "/v1/candidates/me/profile"

TAG_NAME_TAKEN: Final = "urn:sync:problem:tag-name-taken"
TAG_NOT_FOUND: Final = "urn:sync:problem:tag-not-found"
TAG_SCOPE_MISMATCH: Final = "urn:sync:problem:tag-scope-mismatch"
APPLICATION_NOT_FOUND: Final = "urn:sync:problem:application-not-found"
CANDIDATE_NOT_FOUND: Final = "urn:sync:problem:candidate-not-found"
NOTE_NOT_FOUND: Final = "urn:sync:problem:note-not-found"


async def an_application_to_this_tenant(
    recruiter: AsyncClient, applicant: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> dict[str, Any]:
    """One Candidate's Application to one of the Tenant's Jobs — what a note is written on."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(applicant, mailbox, session)
    return await an_accepted_application(applicant, job["id"])


@dataclass(frozen=True, slots=True)
class OneCandidateTwoTenants:
    """One Candidate who applied to two rival Tenants — the shape a leak would show up in."""

    candidate_id: UUID
    here: dict[str, Any]
    there: dict[str, Any]


async def one_candidate_who_applied_to_both(
    recruiter: AsyncClient,
    rival: AsyncClient,
    applicant: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
) -> OneCandidateTwoTenants:
    ours = await a_published_job(recruiter)
    theirs = await a_published_job(rival)
    await a_candidate_who_can_apply(applicant, mailbox, session)
    return OneCandidateTwoTenants(
        candidate_id=await my_id(applicant),
        here=await an_accepted_application(applicant, ours["id"]),
        there=await an_accepted_application(applicant, theirs["id"]),
    )


async def create_tag(
    recruiter: AsyncClient, *, name: str = "Arabic speaker", scope: str = "candidate"
) -> Response:
    return await recruiter.post(TENANT_TAGS, json={"name": name, "scope": scope})


async def a_tag(recruiter: AsyncClient, **changes: Any) -> dict[str, Any]:
    response = await create_tag(recruiter, **changes)
    assert response.status_code == 201, response.text
    tag: dict[str, Any] = response.json()
    return tag


async def list_tags(recruiter: AsyncClient, **params: Any) -> Response:
    return await recruiter.get(TENANT_TAGS, params=params)


async def tags_of(recruiter: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await list_tags(recruiter, **params)
    assert response.status_code == 200, response.text
    tags: list[dict[str, Any]] = response.json()
    return tags


async def rename_tag(recruiter: AsyncClient, tag_id: str | UUID, name: str) -> Response:
    return await recruiter.patch(f"{TENANT_TAGS}/{tag_id}", json={"name": name})


async def delete_tag(recruiter: AsyncClient, tag_id: str | UUID) -> Response:
    return await recruiter.delete(f"{TENANT_TAGS}/{tag_id}")


def application_tags(application_id: str | UUID) -> str:
    return f"{TENANT_APPLICATIONS}/{application_id}/tags"


def candidate_tags(candidate_id: str | UUID) -> str:
    return f"{TENANT_CANDIDATES}/{candidate_id}/tags"


async def put_tag_on(recruiter: AsyncClient, url: str, tag_id: str | UUID) -> Response:
    return await recruiter.put(f"{url}/{tag_id}")


async def take_tag_off(recruiter: AsyncClient, url: str, tag_id: str | UUID) -> Response:
    return await recruiter.delete(f"{url}/{tag_id}")


async def list_assigned_tags(recruiter: AsyncClient, url: str) -> Response:
    return await recruiter.get(url)


async def assigned_tags(recruiter: AsyncClient, url: str) -> list[dict[str, Any]]:
    response = await list_assigned_tags(recruiter, url)
    assert response.status_code == 200, response.text
    tags: list[dict[str, Any]] = response.json()
    return tags


def application_notes(application_id: str | UUID) -> str:
    return f"{TENANT_APPLICATIONS}/{application_id}/notes"


def candidate_notes(candidate_id: str | UUID) -> str:
    return f"{TENANT_CANDIDATES}/{candidate_id}/notes"


async def write_note(recruiter: AsyncClient, url: str, text: str) -> Response:
    return await recruiter.post(url, json={"text": text})


async def a_note(recruiter: AsyncClient, url: str, text: str) -> dict[str, Any]:
    response = await write_note(recruiter, url, text)
    assert response.status_code == 201, response.text
    note: dict[str, Any] = response.json()
    return note


async def list_notes(recruiter: AsyncClient, url: str, **params: Any) -> Response:
    return await recruiter.get(url, params=params)


async def notes_of(recruiter: AsyncClient, url: str, **params: Any) -> list[dict[str, Any]]:
    response = await list_notes(recruiter, url, **params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def edit_note(recruiter: AsyncClient, url: str, note_id: str | UUID, text: str) -> Response:
    return await recruiter.patch(f"{url}/{note_id}", json={"text": text})


async def delete_note(recruiter: AsyncClient, url: str, note_id: str | UUID) -> Response:
    return await recruiter.delete(f"{url}/{note_id}")


async def a_searchable_candidate(
    browser: AsyncClient, mailbox: Mailbox, session: AsyncSession, label: str = "searchable"
) -> UUID:
    """A Candidate who has applied nowhere, but let Global search show them to everyone."""
    await a_signed_in_candidate(browser, mailbox, label)
    candidate_id = await my_id(browser)
    await give_a_current_cv(session, candidate_id)
    opted_in = await browser.put(CANDIDATE_PROFILE, json=a_profile(is_searchable=True))
    assert opted_in.status_code == 200, opted_in.text
    return candidate_id


async def stop_being_searchable(browser: AsyncClient) -> None:
    """The Candidate takes themselves back out of Global search."""
    opted_out = await browser.put(CANDIDATE_PROFILE, json=a_profile(is_searchable=False))
    assert opted_out.status_code == 200, opted_out.text


async def a_candidate_nobody_has_met(
    browser: AsyncClient, mailbox: Mailbox, label: str = "unmet"
) -> UUID:
    """Signed up, applied nowhere, and not Searchable — reachable by no tenant."""
    await a_signed_in_candidate(browser, mailbox, label)
    return await my_id(browser)


async def save_to_pool(recruiter: AsyncClient, candidate_id: str | UUID) -> Response:
    return await recruiter.put(f"{TALENT_POOL}/{candidate_id}")


async def drop_from_pool(recruiter: AsyncClient, candidate_id: str | UUID) -> Response:
    return await recruiter.delete(f"{TALENT_POOL}/{candidate_id}")


async def list_pool(recruiter: AsyncClient, **params: Any) -> Response:
    return await recruiter.get(TALENT_POOL, params=params)


async def pool_of(recruiter: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await list_pool(recruiter, **params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items
