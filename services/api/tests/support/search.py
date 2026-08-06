from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final

from tests.support.candidates import Signup, a_signed_in_candidate, sign_in
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.profiles import a_profile, give_a_current_cv, my_id

if TYPE_CHECKING:
    from uuid import UUID

    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

SEARCH: Final = "/v1/search/candidates"
DIRECTORY: Final = "/v1/directory/candidates"
PROFILE: Final = "/v1/candidates/me/profile"

UNKNOWN_CANONICAL_SKILL: Final = "urn:sync:problem:unknown-canonical-skill"
UNKNOWN_LOCATION: Final = "urn:sync:problem:unknown-location"
UNKNOWN_CANONICAL_ROLE: Final = "urn:sync:problem:unknown-canonical-role"
MALFORMED_SKILL_FILTER: Final = "urn:sync:problem:malformed-skill-filter"


def a_candidate_record(candidate_id: UUID | str) -> str:
    return f"{DIRECTORY}/{candidate_id}"


@dataclass(frozen=True, slots=True)
class Candidate:
    id: UUID
    signup: Signup


async def a_candidate_with(
    app: FastAPI,
    mailbox: Mailbox,
    session: AsyncSession,
    *,
    label: str,
    searchable: bool = True,
    **profile: Any,
) -> Candidate:
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        signup = await a_signed_in_candidate(browser, mailbox, label)
        candidate_id = await my_id(browser)
        await give_a_current_cv(session, candidate_id)
        saved = await browser.put(PROFILE, json=a_profile(is_searchable=searchable, **profile))
        assert saved.status_code == 200, saved.text
        return Candidate(id=candidate_id, signup=signup)


async def rewrite_profile(app: FastAPI, candidate: Candidate, **profile: Any) -> None:
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        signed_in = await sign_in(browser, candidate.signup)
        assert signed_in.status_code == 200, signed_in.text
        saved = await browser.put(PROFILE, json=a_profile(is_searchable=True, **profile))
        assert saved.status_code == 200, saved.text
