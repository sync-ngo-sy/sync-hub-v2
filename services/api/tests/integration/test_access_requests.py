from __future__ import annotations

from dataclasses import replace
from typing import Final

from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core import Settings
from sync_core.models import AccessRequest, AccessRequestStatus, RecruiterRole, Tenant
from tests.conftest import RECRUITER_PORTAL_URL
from tests.support.access_requests import (
    ASK,
    a_slug,
    an_ask,
    ask_for_access,
    convert,
    dismiss,
    read_queue,
)
from tests.support.candidates import a_confirmed_candidate
from tests.support.harness import spa_onto
from tests.support.mailbox import Mailbox
from tests.support.platform_admins import a_new_tenant, a_signed_in_platform_admin, create_tenant
from tests.support.tenants import accept_invite

ALREADY_DECIDED: Final = "urn:sync:problem:access-request-already-decided"
NOT_FOUND: Final = "urn:sync:problem:access-request-not-found"
RATE_LIMITED: Final = "urn:sync:problem:rate-limited"
EMAIL_TAKEN: Final = "urn:sync:problem:email-already-registered"
SLUG_TAKEN: Final = "urn:sync:problem:tenant-slug-taken"

NO_REQUEST: Final = "00000000-0000-0000-0000-000000000000"


async def test_a_visitor_asks_for_access_and_is_told_it_was_received(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    ask = an_ask()

    asked = await ask_for_access(browser, ask)

    assert asked.status_code == 202, asked.text
    assert not asked.content
    recorded = (await db_session.execute(select(AccessRequest))).scalar_one()
    assert recorded.company == ask.company
    assert recorded.full_name == ask.full_name
    assert recorded.email == ask.email
    assert recorded.status is AccessRequestStatus.PENDING


async def test_asking_needs_no_account_at_all(browser: AsyncClient) -> None:
    """The one unauthenticated write on the platform: a company that wants Sync has nobody to
    sign in as yet, which is the whole point of the queue."""
    asked = await ask_for_access(browser, an_ask())

    assert asked.status_code == 202, asked.text
    assert (await browser.get("/v1/auth/me")).status_code == 401


async def test_asking_twice_from_one_address_leaves_one_request(
    browser: AsyncClient, db_session: AsyncSession
) -> None:
    ask = an_ask()
    await ask_for_access(browser, ask)

    again = await ask_for_access(browser, replace(ask, company="Acme Recruiting Ltd"))

    assert again.status_code == 202, again.text
    recorded = (await db_session.execute(select(AccessRequest))).scalar_one()
    assert recorded.company == "Acme Recruiting Ltd"


async def test_a_malformed_address_is_refused(browser: AsyncClient) -> None:
    refused = await ask_for_access(browser, replace(an_ask(), email="not-an-address"))

    assert refused.status_code == 422, refused.text
    assert [error["location"] for error in refused.json()["errors"]] == ["body.email"]


async def test_an_empty_company_is_refused(browser: AsyncClient) -> None:
    refused = await ask_for_access(browser, replace(an_ask(), company=""))

    assert refused.status_code == 422, refused.text
    assert [error["location"] for error in refused.json()["errors"]] == ["body.company"]


async def test_a_company_of_nothing_but_spaces_is_refused_too(browser: AsyncClient) -> None:
    """Trimmed before it is measured, so whitespace cannot pass for a name."""
    refused = await ask_for_access(browser, replace(an_ask(), company="   ", full_name="  "))

    assert refused.status_code == 422, refused.text
    assert [error["location"] for error in refused.json()["errors"]] == [
        "body.company",
        "body.full_name",
    ]


async def test_asking_by_the_handful_is_rate_limited(settings: Settings) -> None:
    """No identity provider is touched, so none of its limits apply — this endpoint carries its
    own, which is what stops a script filling the operator's queue."""
    async with spa_onto(settings, access_request_rate_limit_max_requests=2) as spa:
        assert (await ask_for_access(spa, an_ask())).status_code == 202
        assert (await ask_for_access(spa, an_ask())).status_code == 202

        refused = await ask_for_access(spa, an_ask())

    assert refused.status_code == 429, refused.text
    assert refused.json()["type"] == RATE_LIMITED
    assert refused.headers["Retry-After"]


async def test_a_platform_admin_works_the_queue_oldest_first(
    app: FastAPI, browser: AsyncClient, other_browser: AsyncClient, db_session: AsyncSession
) -> None:
    first = an_ask("first")
    second = an_ask("second")
    await ask_for_access(other_browser, first)
    await ask_for_access(other_browser, second)
    await a_signed_in_platform_admin(app, browser, db_session)

    queue = await read_queue(browser)

    assert queue.status_code == 200, queue.text
    assert [row["email"] for row in queue.json()] == [first.email, second.email]
    assert queue.json()[0]["company"] == first.company
    assert queue.json()[0]["full_name"] == first.full_name


async def test_converting_a_request_opens_the_tenant_it_asked_for(
    app: FastAPI, browser: AsyncClient, other_browser: AsyncClient, db_session: AsyncSession
) -> None:
    """Nothing is retyped: the company, the founding admin and their address all come off the
    request, and the tenant's address is the one thing the operator supplies."""
    ask = an_ask()
    await ask_for_access(other_browser, ask)
    await a_signed_in_platform_admin(app, browser, db_session)
    request_id = (await read_queue(browser)).json()[0]["id"]
    slug = a_slug()

    converted = await convert(browser, request_id, slug=slug)

    assert converted.status_code == 201, converted.text
    body = converted.json()
    assert body["tenant"]["name"] == ask.company
    assert body["tenant"]["slug"] == slug
    assert body["tenant"]["invite_pending"] is True
    assert body["founding_admin"]["email"] == ask.email
    assert body["founding_admin"]["full_name"] == ask.full_name
    assert body["founding_admin"]["role"] == RecruiterRole.ADMIN.value


async def test_the_founding_admin_of_a_converted_request_is_invited(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    ask = an_ask()
    await ask_for_access(other_browser, ask)
    await a_signed_in_platform_admin(app, browser, db_session)
    request_id = (await read_queue(browser)).json()[0]["id"]
    slug = a_slug()
    await convert(browser, request_id, slug=slug)

    assert f"{RECRUITER_PORTAL_URL}/auth/accept-invite" in await mailbox.newest_body(ask.email)
    accepted = await accept_invite(third_browser, mailbox, ask.email)
    assert accepted.status_code == 200, accepted.text
    assert (await third_browser.get("/v1/tenants/me")).json()["slug"] == slug


async def test_a_converted_request_leaves_the_queue(
    app: FastAPI, browser: AsyncClient, other_browser: AsyncClient, db_session: AsyncSession
) -> None:
    await ask_for_access(other_browser, an_ask())
    await a_signed_in_platform_admin(app, browser, db_session)
    request_id = (await read_queue(browser)).json()[0]["id"]

    await convert(browser, request_id, slug=a_slug())

    assert (await read_queue(browser)).json() == []
    recorded = (await db_session.execute(select(AccessRequest))).scalar_one()
    assert recorded.status is AccessRequestStatus.CONVERTED
    assert recorded.decided_at is not None
    tenant = (await db_session.execute(select(Tenant))).scalar_one()
    assert recorded.tenant_id == tenant.id


async def test_a_dismissed_request_leaves_the_queue_and_opens_nothing(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    ask = an_ask()
    await ask_for_access(other_browser, ask)
    await a_signed_in_platform_admin(app, browser, db_session)
    request_id = (await read_queue(browser)).json()[0]["id"]

    dismissed = await dismiss(browser, request_id)

    assert dismissed.status_code == 200, dismissed.text
    assert dismissed.json()["email"] == ask.email
    assert (await read_queue(browser)).json() == []
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 0
    assert await mailbox.count_for(ask.email) == 0
    recorded = (await db_session.execute(select(AccessRequest))).scalar_one()
    assert recorded.status is AccessRequestStatus.DISMISSED
    assert recorded.tenant_id is None


async def test_a_request_can_only_be_decided_once(
    app: FastAPI, browser: AsyncClient, other_browser: AsyncClient, db_session: AsyncSession
) -> None:
    await ask_for_access(other_browser, an_ask())
    await a_signed_in_platform_admin(app, browser, db_session)
    request_id = (await read_queue(browser)).json()[0]["id"]
    await dismiss(browser, request_id)

    refused = await convert(browser, request_id, slug=a_slug())

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == ALREADY_DECIDED
    assert await db_session.scalar(select(func.count()).select_from(Tenant)) == 0


async def test_deciding_a_request_that_does_not_exist_is_a_404(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    missing = await dismiss(browser, NO_REQUEST)

    assert missing.status_code == 404, missing.text
    assert missing.json()["type"] == NOT_FOUND


async def test_a_conversion_the_platform_refuses_leaves_the_request_pending(
    app: FastAPI, browser: AsyncClient, other_browser: AsyncClient, db_session: AsyncSession
) -> None:
    """A slug already taken is one correction away, not a lost ask."""
    taken = a_new_tenant()
    await ask_for_access(other_browser, an_ask())
    await a_signed_in_platform_admin(app, browser, db_session)
    await create_tenant(browser, taken)
    request_id = (await read_queue(browser)).json()[0]["id"]

    refused = await convert(browser, request_id, slug=taken.slug)

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == SLUG_TAKEN
    assert [row["id"] for row in (await read_queue(browser)).json()] == [request_id]


async def test_a_request_from_somebody_who_already_has_an_account_is_refused_the_usual_way(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate = await a_confirmed_candidate(other_browser, mailbox)
    await ask_for_access(third_browser, an_ask(email=candidate.email))
    await a_signed_in_platform_admin(app, browser, db_session)
    request_id = (await read_queue(browser)).json()[0]["id"]

    refused = await convert(browser, request_id, slug=a_slug())

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == EMAIL_TAKEN
    assert [row["id"] for row in (await read_queue(browser)).json()] == [request_id]


async def test_creating_a_tenant_is_no_longer_something_a_stranger_can_do(
    browser: AsyncClient,
) -> None:
    """The rule is the backend's, not the interface's: there is no public endpoint left to call."""
    gone = await browser.post(
        "/v1/tenants",
        json={
            "tenant_name": "Acme Recruiting",
            "slug": a_slug(),
            "email": "founder@example.com",
            "password": "correct-horse-battery",
            "full_name": "Rana Khalil",
        },
    )

    assert gone.status_code == 404, gone.text


async def test_reading_the_queue_is_not_public(browser: AsyncClient) -> None:
    assert (await ask_for_access(browser, an_ask())).status_code == 202
    assert (await read_queue(browser)).status_code == 401
    assert (await browser.post(f"{ASK}", json={})).status_code == 422
