from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import uuid4

from tests.support.candidates import a_signed_in_candidate
from tests.support.crm import (
    CANDIDATE_NOT_FOUND,
    a_candidate_nobody_has_met,
    an_application_to_this_tenant,
    save_to_pool,
)
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.profiles import my_id
from tests.support.search import a_candidate_record, a_candidate_with
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox


def _said(problem: dict[str, Any]) -> dict[str, Any]:
    """What the answer says, without the two fields that name this request rather than its
    subject — an `instance` holding the id asked for cannot be the same for two ids."""
    return {key: problem[key] for key in ("type", "title", "status", "detail")}


A_WHOLE_PROFILE: dict[str, Any] = {
    "headline": "Backend engineer",
    "summary": "Builds payment systems.",
    "phone": "+963115550134",
    "phone_country": "SY",
    "linkedin_url": "linkedin.com/in/amina-haddad",
    "github_url": "amina-haddad",
    "portfolio_url": "amina-haddad.dev",
    "location_key": "sy-damascus",
    "canonical_role_key": "backend-engineer",
    "skills": [{"name": "Python", "years_experience": 8.0}],
    "languages": [{"code": "ar", "proficiency": "native"}],
    "educations": [
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
            "description": None,
        }
    ],
    "projects": [
        {
            "name": "Ledger",
            "description": "Double-entry bookkeeping.",
            "project_url": None,
            "repository_url": None,
            "start_year": 2022,
            "start_month": 3,
            "end_year": None,
            "end_month": None,
        }
    ],
    "experiences": [
        {
            "job_title": "Backend engineer",
            "company_name": "Acme",
            "start_year": 2016,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": "Payments.",
        }
    ],
}


async def test_reading_one_candidate_answers_with_their_whole_profile(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_WHOLE_PROFILE)

    response = await recruiter.get(a_candidate_record(amina.id))

    assert response.status_code == 200, response.text
    record = response.json()
    assert record["full_name"] == "Amina Haddad"
    assert record["headline"] == "Backend engineer"
    assert record["location_name"] == "Damascus"
    assert record["canonical_role_name"] == "Backend Engineer"
    assert record["total_experience_years"] == 8
    assert [skill["name"] for skill in record["skills"]] == ["Python"]
    assert [job["company_name"] for job in record["experiences"]] == ["Acme"]
    assert [study["institution"] for study in record["educations"]] == ["Damascus University"]
    assert [spoken["code"] for spoken in record["languages"]] == ["ar"]
    assert [project["name"] for project in record["projects"]] == ["Ledger"]


async def test_a_profile_is_where_a_phone_and_an_email_are_readable(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_WHOLE_PROFILE)

    record = (await recruiter.get(a_candidate_record(amina.id))).json()

    assert record["phone"] == "+963115550134"
    assert record["phone_country"] == "SY"
    assert record["email"] == amina.signup.email


async def test_a_recruiter_reads_the_links_the_candidate_claimed(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_WHOLE_PROFILE)

    record = (await recruiter.get(a_candidate_record(amina.id))).json()

    assert record["linkedin_url"] == "https://www.linkedin.com/in/amina-haddad"
    assert record["github_url"] == "https://github.com/amina-haddad"
    assert record["portfolio_url"] == "https://amina-haddad.dev"


async def test_a_candidate_outside_the_tenants_reach_reads_as_absent(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox
) -> None:
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        stranger = await a_candidate_nobody_has_met(browser, mailbox)

    unreachable = await recruiter.get(a_candidate_record(stranger))
    nobody = await recruiter.get(a_candidate_record(uuid4()))

    assert unreachable.status_code == 404, unreachable.text
    assert nobody.status_code == 404, nobody.text
    assert unreachable.json()["type"] == CANDIDATE_NOT_FOUND
    assert _said(unreachable.json()) == _said(nobody.json())


async def test_an_applicant_who_is_not_searchable_is_still_readable(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Reach is not the same question as Global search: they applied here."""
    async with asgi_client(app, headers=SPA_HEADERS) as applicant:
        await an_application_to_this_tenant(recruiter, applicant, mailbox, db_session)
        applicant_id = await my_id(applicant)

    response = await recruiter.get(a_candidate_record(applicant_id))

    assert response.status_code == 200, response.text
    assert response.json()["candidate_id"] == str(applicant_id)


async def test_a_record_says_whether_the_tenant_has_them_in_its_talent_pool(
    app: FastAPI,
    recruiter: AsyncClient,
    rival: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_WHOLE_PROFILE)
    assert (await recruiter.get(a_candidate_record(amina.id))).json()["in_talent_pool"] is False

    saved = await save_to_pool(recruiter, amina.id)
    assert saved.status_code == 200, saved.text

    assert (await recruiter.get(a_candidate_record(amina.id))).json()["in_talent_pool"] is True
    assert (await rival.get(a_candidate_record(amina.id))).json()["in_talent_pool"] is False


async def test_only_a_recruiter_can_read_a_candidate(
    app: FastAPI, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_WHOLE_PROFILE)
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        signed_out = await browser.get(a_candidate_record(amina.id))
        await a_signed_in_candidate(browser, mailbox, "nosy")
        candidate = await browser.get(a_candidate_record(amina.id))

    assert signed_out.status_code == 401, signed_out.text
    assert candidate.status_code == 403, candidate.text


async def test_a_recruiter_of_another_tenant_reads_a_searchable_candidate_too(
    app: FastAPI, rival: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Searchable is one opt-in to every Tenant, not a relationship with one of them."""
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        await an_admin(browser, mailbox, label="third")
        amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_WHOLE_PROFILE)

        assert (await browser.get(a_candidate_record(amina.id))).status_code == 200
        assert (await rival.get(a_candidate_record(amina.id))).status_code == 200
