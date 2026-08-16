from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import text

from sync_api.tenants.presets import PRESET_TAGS, PRESET_TEMPLATES
from sync_core.models import TagScope
from tests.support.access_requests import a_slug, an_ask, ask_for_access, convert, read_queue
from tests.support.platform_admins import a_signed_in_platform_admin
from tests.support.tenants import accept_invite

if TYPE_CHECKING:
    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox


async def a_converted_tenant(
    app: FastAPI,
    operator: AsyncClient,
    visitor: AsyncClient,
    founder: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
) -> AsyncClient:
    """A Tenant opened the only way one is: a company asks, and an operator converts the ask."""
    ask = an_ask()
    await ask_for_access(visitor, ask)
    await a_signed_in_platform_admin(app, operator, session)
    request_id = (await read_queue(operator)).json()[0]["id"]
    converted = await convert(operator, request_id, slug=a_slug())
    assert converted.status_code == 201, converted.text

    accepted = await accept_invite(founder, mailbox, ask.email)
    assert accepted.status_code == 200, accepted.text
    return founder


async def tags_of(browser: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await browser.get("/v1/tenants/me/tags", params=params)
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


async def templates_of(browser: AsyncClient) -> list[dict[str, Any]]:
    response = await browser.get("/v1/tenants/me/message-templates")
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


async def test_a_converted_tenant_opens_with_message_templates(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    founder = await a_converted_tenant(
        app, browser, other_browser, third_browser, mailbox, db_session
    )

    templates = await templates_of(founder)

    assert sorted(template["name"] for template in templates) == sorted(
        name for name, _subject, _body in PRESET_TEMPLATES
    )


async def test_a_converted_tenant_opens_with_tags_of_both_scopes(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    founder = await a_converted_tenant(
        app, browser, other_browser, third_browser, mailbox, db_session
    )

    tags = await tags_of(founder)

    assert {(tag["name"], tag["scope"]) for tag in tags} == {
        (name, scope.value) for name, scope in PRESET_TAGS
    }
    assert await tags_of(founder, scope=TagScope.CANDIDATE.value)
    assert await tags_of(founder, scope=TagScope.APPLICATION.value)


async def test_the_templates_are_attributed_to_the_founding_admin(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Nobody else exists to attribute them to: the founding admin is written in the same commit."""
    founder = await a_converted_tenant(
        app, browser, other_browser, third_browser, mailbox, db_session
    )
    me = (await founder.get("/v1/auth/me")).json()

    authors = await db_session.execute(
        text("select distinct created_by_recruiter_id::text from message_templates")
    )

    assert [row[0] for row in authors] == [me["id"]]


async def test_a_preset_tag_is_an_ordinary_row(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """No preset flag anywhere: a Tenant renames and deletes these exactly as it does its own."""
    founder = await a_converted_tenant(
        app, browser, other_browser, third_browser, mailbox, db_session
    )
    tags = await tags_of(founder)

    renamed = await founder.patch(f"/v1/tenants/me/tags/{tags[0]['id']}", json={"name": "Ours now"})
    deleted = await founder.delete(f"/v1/tenants/me/tags/{tags[1]['id']}")

    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Ours now"
    assert deleted.status_code == 204, deleted.text
    assert len(await tags_of(founder)) == len(PRESET_TAGS) - 1


async def test_a_preset_template_is_an_ordinary_row(
    app: FastAPI,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    founder = await a_converted_tenant(
        app, browser, other_browser, third_browser, mailbox, db_session
    )
    templates = await templates_of(founder)

    revised = await founder.put(
        f"/v1/tenants/me/message-templates/{templates[0]['id']}",
        json={
            "name": "Ours now",
            "subject": "About {{ job_title }}",
            "body": "Hi {{ candidate_name }},\n\nWe will be in touch.\n\n{{ tenant_name }}",
        },
    )
    deleted = await founder.delete(f"/v1/tenants/me/message-templates/{templates[1]['id']}")

    assert revised.status_code == 200, revised.text
    assert revised.json()["name"] == "Ours now"
    assert deleted.status_code == 204, deleted.text
    assert len(await templates_of(founder)) == len(PRESET_TEMPLATES) - 1
