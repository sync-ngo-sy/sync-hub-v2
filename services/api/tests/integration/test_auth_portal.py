from __future__ import annotations

from typing import TYPE_CHECKING

from httpx import AsyncClient

from tests.conftest import ADMIN_PORTAL_URL, CANDIDATE_PORTAL_URL, RECRUITER_PORTAL_URL
from tests.support.candidates import Signup, a_signed_in_candidate, sign_in
from tests.support.platform_admins import a_platform_admin
from tests.support.tenants import FoundedTenant, an_admin

if TYPE_CHECKING:
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox


def as_a_signup(tenant: FoundedTenant) -> Signup:
    return Signup(email=tenant.email, password=tenant.password, full_name=tenant.full_name)


async def portal_url_of(browser: AsyncClient) -> str:
    response = await browser.get("/v1/auth/me")
    assert response.status_code == 200, response.text
    return response.json()["portal_url"]


async def test_a_candidate_is_told_the_candidate_portal(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    assert await portal_url_of(browser) == CANDIDATE_PORTAL_URL


async def test_a_recruiter_is_told_the_recruiter_portal(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    assert await portal_url_of(browser) == RECRUITER_PORTAL_URL


async def test_a_platform_admin_is_told_the_platform_portal(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = await a_platform_admin(app, db_session)
    await sign_in(browser, signup)

    assert await portal_url_of(browser) == ADMIN_PORTAL_URL


async def test_signing_in_is_told_the_portal_without_a_second_request(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The portal a person belongs to is on the sign-in answer itself, so a portal that serves
    the wrong account type never has to ask twice to find out where to send them."""
    tenant = await an_admin(browser, mailbox)

    response = await sign_in(browser, as_a_signup(tenant))

    assert response.status_code == 200, response.text
    assert response.json()["portal_url"] == RECRUITER_PORTAL_URL
