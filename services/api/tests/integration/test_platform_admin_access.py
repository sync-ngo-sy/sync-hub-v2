from __future__ import annotations

from typing import TYPE_CHECKING, Final

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from sync_api.app import create_app
from sync_core.models import AccountType, Candidate, PlatformAdmin, Profile, Recruiter
from tests.support.candidates import a_signed_in_candidate
from tests.support.platform_admins import (
    PROBE,
    a_platform_admin,
    a_signed_in_platform_admin,
    mount_the_probe,
)
from tests.support.profiles import my_id
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings
    from tests.support.mailbox import Mailbox

CANDIDATE_ONLY_ROUTES: Final = (
    "/v1/candidates/me/profile",
    "/v1/candidates/me/cvs",
    "/v1/applications",
)

TENANT_SCOPED_ROUTES: Final = ("/v1/tenants/me", "/v1/tenants/me/members", "/v1/tenants/me/jobs")

CANDIDATE_ONLY: Final = "urn:sync:problem:candidate-only"
RECRUITER_ONLY: Final = "urn:sync:problem:recruiter-only"
PLATFORM_ADMIN_ONLY: Final = "urn:sync:problem:platform-admin-only"


@pytest.fixture(scope="module")
async def app(settings: Settings, _migrated_database: None) -> AsyncIterator[FastAPI]:
    """Every client in this module rides on an app carrying one extra route: the guard, alone.

    Not the shared app: the probe is not a product operation, and mounting it there would put a
    route in the OpenAPI document that no client should ever be generated against.
    """
    application = create_app(settings)
    mount_the_probe(application)
    async with LifespanManager(application):
        yield application


async def test_the_signed_in_profile_reports_the_new_account_type(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    signup = await a_signed_in_platform_admin(app, browser, db_session)

    me = await browser.get("/v1/auth/me")

    assert me.status_code == 200, me.text
    assert me.json()["account_type"] == AccountType.PLATFORM_ADMIN.value
    assert me.json()["email"] == signup.email


async def test_a_platform_admin_belongs_to_no_tenant(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    admins = (await db_session.scalars(select(PlatformAdmin))).all()
    recruiters = await db_session.scalar(select(func.count()).select_from(Recruiter))
    candidates = await db_session.scalar(select(func.count()).select_from(Candidate))

    assert len(admins) == 1
    assert recruiters == 0
    assert candidates == 0


async def test_a_platform_admin_cannot_also_be_a_candidate(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)
    admin = (await db_session.scalars(select(PlatformAdmin))).one()

    db_session.add(Candidate(id=admin.id))
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_a_candidate_cannot_also_be_a_platform_admin(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The direction the new table introduces, refused by the composite FK rather than a rule."""
    await a_signed_in_candidate(browser, mailbox)

    db_session.add(PlatformAdmin(id=await my_id(browser)))
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_a_recruiter_cannot_also_be_a_platform_admin(
    recruiter: AsyncClient, db_session: AsyncSession
) -> None:
    db_session.add(PlatformAdmin(id=await my_id(recruiter)))
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.parametrize("route", CANDIDATE_ONLY_ROUTES)
async def test_a_platform_admin_is_refused_every_candidate_only_route(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession, route: str
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    refused = await browser.get(route)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == CANDIDATE_ONLY


@pytest.mark.parametrize("route", TENANT_SCOPED_ROUTES)
async def test_a_platform_admin_is_refused_every_tenant_scoped_route(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession, route: str
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    refused = await browser.get(route)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == RECRUITER_ONLY


async def test_a_platform_admin_reaches_a_platform_admin_only_route(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    await a_signed_in_platform_admin(app, browser, db_session)

    allowed = await browser.get(PROBE)

    assert allowed.status_code == 200, allowed.text


async def test_a_candidate_is_refused_a_platform_admin_only_route(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    refused = await browser.get(PROBE)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == PLATFORM_ADMIN_ONLY


async def test_a_recruiter_is_refused_a_platform_admin_only_route(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    refused = await browser.get(PROBE)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == PLATFORM_ADMIN_ONLY


async def test_nobody_at_all_is_refused_a_platform_admin_only_route(
    visitor: AsyncClient,
) -> None:
    refused = await visitor.get(PROBE)

    assert refused.status_code == 401, refused.text


async def test_a_profile_typed_platform_admin_without_its_row_is_refused(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    """The discriminator alone is not the account: the row it points at has to be there."""
    await a_signed_in_platform_admin(app, browser, db_session)
    await db_session.execute(delete(PlatformAdmin))
    await db_session.commit()

    refused = await browser.get(PROBE)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == PLATFORM_ADMIN_ONLY


async def test_the_bootstrap_leaves_a_confirmed_account_that_can_sign_in_again(
    app: FastAPI, browser: AsyncClient, db_session: AsyncSession
) -> None:
    """No confirmation email stands between the script and a usable operator account."""
    signup = await a_platform_admin(app, db_session)

    signed_in = await browser.post(
        "/v1/auth/login", json={"email": signup.email, "password": signup.password}
    )

    assert signed_in.status_code == 200, signed_in.text
    assert signed_in.json()["account_type"] == AccountType.PLATFORM_ADMIN.value
    profile = await db_session.scalar(select(Profile).where(Profile.full_name == signup.full_name))
    assert profile is not None
    assert profile.account_type is AccountType.PLATFORM_ADMIN
