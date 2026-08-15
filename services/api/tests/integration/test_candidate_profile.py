from __future__ import annotations

import asyncio
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import CvParsingStatus
from sync_core.profile import MAX_ENTRIES, MAX_LINE_LENGTH
from tests.support.candidates import a_signed_in_candidate, sign_in
from tests.support.mailbox import Mailbox
from tests.support.profiles import (
    EMPTY_PROFILE,
    SECTIONS,
    a_filled_profile,
    a_profile,
    completed_at,
    embedding_jobs,
    give_a_current_cv,
    my_id,
    my_profile,
    section_row_counts,
)
from tests.support.tenants import an_admin

PROFILE = "/v1/candidates/me/profile"
EXPERIENCE_TOTAL = f"{PROFILE}/experience-total"
SEARCHABLE_REFUSAL = "urn:sync:problem:searchable-needs-a-complete-profile"

A_FULL_PROFILE: dict[str, Any] = {
    "full_name": "Amina Haddad",
    "phone": "+963115550100",
    "phone_country": "SY",
    "headline": "Backend engineer, 8 years",
    "summary": "Builds boring systems that stay up.",
    "location_key": "sy-damascus",
    "canonical_role_key": "backend-engineer",
    "is_searchable": False,
    "linkedin_url": "https://www.linkedin.com/in/amina-haddad",
    "github_url": "https://github.com/amina-haddad",
    "portfolio_url": "https://amina-haddad.dev",
    "experiences": [
        {
            "job_title": "Senior Engineer",
            "company_name": "Acme",
            "start_year": 2021,
            "start_month": 3,
            "end_year": None,
            "end_month": None,
            "is_current": True,
            "description": "Payments, and the on-call rota that came with them.",
        },
        {
            "job_title": "Engineer",
            "company_name": "Globex",
            "start_year": 2018,
            "start_month": 1,
            "end_year": 2021,
            "end_month": 2,
            "is_current": False,
            "description": None,
        },
    ],
    "educations": [
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
            "description": None,
        }
    ],
    "skills": [
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": 6.5},
    ],
    "languages": [
        {"code": "ar", "proficiency": "native"},
        {"code": "en", "proficiency": "fluent"},
    ],
    "projects": [
        {
            "name": "Sync",
            "description": "A recruitment platform.",
            "project_url": "https://example.com/sync",
            "repository_url": None,
            "start_year": 2024,
            "start_month": 6,
            "end_year": None,
            "end_month": None,
        }
    ],
    "unmapped_skills": ["Kubernetes wrangling"],
}


def as_typed(profile: dict[str, Any]) -> dict[str, Any]:
    """A profile without the fields the platform derives — what the candidate actually typed.

    `total_experience_years` counts a current job up to today, so it moves on its own; the tests
    that own it date every job and pin the answer.
    """
    return {key: value for key, value in profile.items() if key != "total_experience_years"}


ONE_SAVE: dict[str, Any] = a_profile(
    headline="First",
    skills=[{"name": "Python", "years_experience": 8.0}],
    languages=[{"code": "en", "proficiency": "fluent"}],
)
THE_OTHER_SAVE: dict[str, Any] = a_profile(
    headline="Second",
    skills=[{"name": "Go", "years_experience": 1.0}],
    languages=[{"code": "ar", "proficiency": "native"}],
)

SOME_SECTIONS: dict[str, Any] = {
    "experiences": [{"job_title": "Engineer", "start_year": 2020, "is_current": True}],
    "educations": [{"institution": "Damascus University"}],
    "skills": [{"name": "Python", "years_experience": 4.0}],
    "languages": [{"code": "en", "proficiency": "fluent"}],
    "projects": [{"name": "Sync"}],
}


async def test_a_new_candidate_has_an_empty_profile(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(PROFILE)

    assert response.status_code == 200, response.text
    assert response.json() == EMPTY_PROFILE


async def test_a_saved_profile_comes_back_exactly_as_it_was_sent(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json=A_FULL_PROFILE)

    assert saved.status_code == 200, saved.text
    assert as_typed(saved.json()) == as_typed(A_FULL_PROFILE)
    assert as_typed((await browser.get(PROFILE)).json()) == as_typed(A_FULL_PROFILE)


async def test_the_name_and_phone_are_written_through_to_the_account(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """One profile, spread across two tables. The candidate should not be able to tell."""
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(
        PROFILE,
        json=a_profile(full_name="Amina Haddad-Nassar", phone="+963115550199", phone_country="SY"),
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["full_name"] == "Amina Haddad-Nassar"
    me = (await browser.get("/v1/auth/me")).json()
    assert me["full_name"] == "Amina Haddad-Nassar"
    assert (me["phone"], me["phone_country"]) == ("+963115550199", "SY")
    reloaded = (await browser.get(PROFILE)).json()
    assert (reloaded["phone"], reloaded["phone_country"]) == ("+963115550199", "SY")


async def test_a_number_is_stored_the_one_way_however_the_candidate_wrote_it(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The field sends E.164; anything else that reaches here meets the same standard."""
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json=a_profile(phone="011 555 0100", phone_country="SY"))

    assert saved.status_code == 200, saved.text
    assert saved.json()["phone"] == "+963115550100"
    assert (await browser.get(PROFILE)).json()["phone"] == "+963115550100"


async def test_a_number_the_chosen_country_cannot_dial_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """A Los Angeles number claimed as Canadian. Both are `+1`, and only one of them is true."""
    await a_signed_in_candidate(browser, mailbox)

    refused = await browser.put(PROFILE, json=a_profile(phone="+12133734253", phone_country="CA"))

    assert refused.status_code == 422, refused.text


@pytest.mark.parametrize(("phone", "country"), [("+963115550100", None), (None, "SY")])
async def test_half_a_phone_is_refused(
    browser: AsyncClient, mailbox: Mailbox, phone: str | None, country: str | None
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    refused = await browser.put(PROFILE, json=a_profile(phone=phone, phone_country=country))

    assert refused.status_code == 422, refused.text


async def test_a_profile_still_exists_with_no_phone_at_all(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json=a_profile())

    assert saved.status_code == 200, saved.text
    assert saved.json()["phone"] is None
    assert saved.json()["phone_country"] is None


async def test_an_email_address_is_not_settable_on_the_profile(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Only auth has a confirmed address, so nothing here can claim to change one."""
    signup = await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json={**a_profile(), "email": "someone-else@example.com"})

    assert saved.status_code == 200, saved.text
    assert "email" not in saved.json()
    assert (await browser.get("/v1/auth/me")).json()["email"] == signup.email


async def test_unmapped_skills_are_kept_as_typed_and_deduplicated_case_insensitively(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(
        PROFILE, json=a_profile(unmapped_skills=["Kubernetes", "kubernetes", "Bash"])
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["unmapped_skills"] == ["Kubernetes", "Bash"]


async def test_saving_again_replaces_every_section_instead_of_adding_to_it(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    emptied = await browser.put(
        PROFILE,
        json=a_profile(
            headline="Staff engineer",
            experiences=[A_FULL_PROFILE["experiences"][1]],
            skills=[{"name": "Go", "years_experience": 2.0}],
        ),
    )

    assert emptied.status_code == 200, emptied.text
    assert emptied.json()["educations"] == []
    assert emptied.json()["projects"] == []
    assert emptied.json()["experiences"] == [A_FULL_PROFILE["experiences"][1]]
    assert await section_row_counts(db_session, candidate_id) == {
        "experiences": 1,
        "educations": 0,
        "skills": 1,
        "languages": 0,
        "projects": 0,
    }


async def test_however_many_saves_leave_the_worker_exactly_one_job(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    [enqueued_at_signup] = await embedding_jobs(db_session, candidate_id)

    for headline in ("First", "Second", "Third"):
        saved = await browser.put(PROFILE, json=a_profile(headline=headline, **SOME_SECTIONS))
        assert saved.status_code == 200, saved.text

    [job] = await embedding_jobs(db_session, candidate_id)
    assert job.dirty is True
    assert job.revision > enqueued_at_signup.revision
    assert job.claimed_at is None


async def test_a_skill_outside_the_taxonomy_is_refused_and_named(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.put(
        PROFILE,
        json=a_profile(
            skills=[
                {"name": "Python", "years_experience": 3.0},
                {"name": "Pythonn", "years_experience": 1.0},
            ]
        ),
    )

    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    problem = response.json()
    assert problem["type"] == "urn:sync:problem:unknown-canonical-skill"
    assert [error["location"] for error in problem["errors"]] == ["body.skills.1.name"]


async def test_a_language_the_platform_does_not_know_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.put(
        PROFILE,
        json=a_profile(
            languages=[
                {"code": "en", "proficiency": "fluent"},
                {"code": "qq", "proficiency": "beginner"},
            ],
        ),
    )

    assert response.status_code == 422
    problem = response.json()
    assert problem["type"] == "urn:sync:problem:unknown-language"
    assert [error["location"] for error in problem["errors"]] == ["body.languages.1.code"]


async def test_a_refused_save_leaves_the_previous_profile_exactly_as_it_was(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    refused = await browser.put(
        PROFILE,
        json=a_profile(headline="Wiped", skills=[{"name": "Sorcery", "years_experience": 1.0}]),
    )

    assert refused.status_code == 422
    assert as_typed((await browser.get(PROFILE)).json()) == as_typed(A_FULL_PROFILE)
    assert await section_row_counts(db_session, candidate_id) == {
        "experiences": 2,
        "educations": 1,
        "skills": 2,
        "languages": 2,
        "projects": 1,
    }


async def test_the_searchable_flag_goes_on_and_off_again(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(db_session, await my_id(browser))

    opted_in = await browser.put(PROFILE, json=a_filled_profile(is_searchable=True))
    opted_out = await browser.put(PROFILE, json=a_filled_profile(is_searchable=False))

    assert opted_in.status_code == 200, opted_in.text
    assert opted_in.json()["is_searchable"] is True
    assert opted_out.json()["is_searchable"] is False
    assert (await browser.get(PROFILE)).json()["is_searchable"] is False


async def test_two_saves_at_once_leave_one_of_them_whole(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    signup = await a_signed_in_candidate(browser, mailbox)
    second_tab = await sign_in(other_browser, signup)
    assert second_tab.status_code == 200, second_tab.text

    saves = await asyncio.gather(
        browser.put(PROFILE, json=ONE_SAVE), other_browser.put(PROFILE, json=THE_OTHER_SAVE)
    )

    assert [save.status_code for save in saves] == [200, 200], [save.text for save in saves]
    assert (await browser.get(PROFILE)).json() in (ONE_SAVE, THE_OTHER_SAVE)


async def test_opting_in_without_a_cv_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    refused = await browser.put(
        PROFILE, json=a_profile(headline="Open to work", is_searchable=True)
    )

    assert refused.status_code == 409
    assert refused.json()["type"] == SEARCHABLE_REFUSAL
    assert "a CV that has been read" in refused.json()["detail"]
    assert (await browser.get(PROFILE)).json() == EMPTY_PROFILE


async def test_opting_in_before_the_cv_is_parsed_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(
        db_session, await my_id(browser), parsing_status=CvParsingStatus.UPLOADED
    )

    refused = await browser.put(PROFILE, json=a_profile(is_searchable=True))

    assert refused.status_code == 409
    assert refused.json()["type"] == SEARCHABLE_REFUSAL


async def test_opting_in_with_a_read_cv_but_a_thin_profile_is_refused_and_says_what_is_missing(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(db_session, await my_id(browser))

    refused = await browser.put(PROFILE, json=a_filled_profile(languages=[], is_searchable=True))

    assert refused.status_code == 409, refused.text
    detail = refused.json()["detail"]
    assert refused.json()["type"] == SEARCHABLE_REFUSAL
    assert "at least one language" in detail
    assert "a summary" not in detail
    assert (await browser.get(PROFILE)).json() == EMPTY_PROFILE


async def test_a_complete_profile_may_opt_into_global_search(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(db_session, await my_id(browser))

    opted_in = await browser.put(PROFILE, json=a_filled_profile(is_searchable=True))

    assert opted_in.status_code == 200, opted_in.text
    assert opted_in.json()["is_searchable"] is True


async def test_a_profile_becomes_complete_in_the_save_that_finishes_it(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)

    part_way = await browser.put(PROFILE, json=a_filled_profile(summary=None))
    assert part_way.status_code == 200, part_way.text
    assert await completed_at(db_session, candidate_id) is None

    finished = await browser.put(PROFILE, json=a_filled_profile())

    assert finished.status_code == 200, finished.text
    assert await completed_at(db_session, candidate_id) is not None


async def test_a_profile_taken_back_apart_is_not_complete_any_more(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)
    await browser.put(PROFILE, json=a_filled_profile(is_searchable=True))

    emptied = await browser.put(PROFILE, json=a_filled_profile(skills=[]))

    assert emptied.status_code == 200, emptied.text
    assert await completed_at(db_session, candidate_id) is None
    assert (await browser.get(PROFILE)).json()["is_searchable"] is False


async def test_emptying_a_field_of_a_complete_profile_saves_rather_than_faults(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The marker is cleared before the emptied field reaches Postgres, not after: a CHECK
    refuses a complete marker beside a profile with no headline, and a Candidate who deleted
    one line is owed a saved profile rather than a 500."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)
    await browser.put(PROFILE, json=a_filled_profile())
    assert await completed_at(db_session, candidate_id) is not None

    emptied = await browser.put(PROFILE, json=a_filled_profile(headline=None))

    assert emptied.status_code == 200, emptied.text
    assert emptied.json()["headline"] is None
    assert await completed_at(db_session, candidate_id) is None


async def test_the_optional_sections_never_stand_between_a_profile_and_complete(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)

    saved = await browser.put(
        PROFILE,
        json=a_filled_profile(
            projects=[], unmapped_skills=[], linkedin_url=None, github_url=None, portfolio_url=None
        ),
    )

    assert saved.status_code == 200, saved.text
    assert await completed_at(db_session, candidate_id) is not None


async def test_a_recruiter_is_refused_at_the_candidate_routes(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    read = await browser.get(PROFILE)
    written = await browser.put(PROFILE, json=EMPTY_PROFILE)

    for refused in (read, written):
        assert refused.status_code == 403, refused.text
        assert refused.json()["type"] == "urn:sync:problem:candidate-only"


async def test_a_stranger_is_refused_at_the_candidate_routes(browser: AsyncClient) -> None:
    assert (await browser.get(PROFILE)).status_code == 401
    assert (await browser.put(PROFILE, json=EMPTY_PROFILE)).status_code == 401


async def test_one_candidate_cannot_reach_another_candidates_profile(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox, label="first")
    await a_signed_in_candidate(other_browser, mailbox, label="second")
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    assert (await other_browser.get(PROFILE)).json() == EMPTY_PROFILE
    assert await section_row_counts(db_session, await my_id(other_browser)) == dict.fromkeys(
        SECTIONS, 0
    )


MALFORMED = {
    "an experience that ends before it starts": (
        {"experiences": [{"job_title": "Engineer", "start_year": 2020, "end_year": 2019}]},
        "body.experiences.0",
    ),
    "a current job with an end date": (
        {
            "experiences": [
                {"job_title": "Engineer", "start_year": 2020, "is_current": True, "end_year": 2024}
            ]
        },
        "body.experiences.0",
    ),
    "a project that ends before it starts": (
        {
            "projects": [
                {
                    "name": "Sync",
                    "start_year": 2024,
                    "start_month": 6,
                    "end_year": 2024,
                    "end_month": 5,
                }
            ]
        },
        "body.projects.0",
    ),
    "a year before the schema's range": (
        {"educations": [{"institution": "Somewhere", "graduation_year": 1899}]},
        "body.educations.0.graduation_year",
    ),
    "a thirteenth month": (
        {"experiences": [{"job_title": "Engineer", "start_year": 2020, "start_month": 13}]},
        "body.experiences.0.start_month",
    ),
    "a skill with no years at all": (
        {"skills": [{"name": "Python"}]},
        "body.skills.0.years_experience",
    ),
    "negative years of experience": (
        {"skills": [{"name": "Python", "years_experience": -1}]},
        "body.skills.0.years_experience",
    ),
    "more years of experience than the column holds": (
        {"skills": [{"name": "Python", "years_experience": 1000}]},
        "body.skills.0.years_experience",
    ),
    "more entries than a section holds": (
        {
            "experiences": [{"job_title": "Engineer", "start_year": 2020, "end_year": 2021}]
            * (MAX_ENTRIES + 1)
        },
        "body.experiences",
    ),
    "more unmapped skills than the section holds": (
        {"unmapped_skills": ["Sorcery"] * (MAX_ENTRIES + 1)},
        "body.unmapped_skills",
    ),
    "an unmapped skill longer than a line": (
        {"unmapped_skills": ["x" * (MAX_LINE_LENGTH + 1)]},
        "body.unmapped_skills.0",
    ),
    "no name at all": ({"full_name": ""}, "body.full_name"),
    "the same skill twice": (
        {
            "skills": [
                {"name": "Python", "years_experience": 1.0},
                {"name": "Python", "years_experience": 2.0},
            ]
        },
        "body.skills",
    ),
    "the same language twice": (
        {
            "languages": [
                {"code": "en", "proficiency": "fluent"},
                {"code": "en", "proficiency": "beginner"},
            ]
        },
        "body.languages",
    ),
}


@pytest.mark.parametrize(("section", "location"), MALFORMED.values(), ids=list(MALFORMED))
async def test_a_shape_the_schema_would_refuse_is_refused_here(
    browser: AsyncClient, mailbox: Mailbox, section: dict[str, Any], location: str
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.put(PROFILE, json=a_profile(**section))

    assert response.status_code == 422, response.text
    problem = response.json()
    assert problem["type"] == "urn:sync:problem:validation-error"
    assert [error["location"] for error in problem["errors"]] == [location]


async def test_an_empty_form_field_reads_as_unset(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(
        PROFILE, json=a_profile(headline="   ", summary="", location_key=None)
    )

    assert saved.status_code == 200, saved.text
    assert saved.json() == EMPTY_PROFILE


def a_job(start: tuple[int, int], end: tuple[int, int] | None, **changes: Any) -> dict[str, Any]:
    """One finished or current job, dated to the month."""
    return {
        "job_title": "Engineer",
        "company_name": "Acme",
        "start_year": start[0],
        "start_month": start[1],
        "end_year": None if end is None else end[0],
        "end_month": None if end is None else end[1],
        "is_current": end is None,
        "description": None,
        **changes,
    }


async def test_a_candidate_chooses_a_canonical_role_and_clears_it_again(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    chosen = await browser.put(PROFILE, json=a_profile(canonical_role_key="frontend-engineer"))
    cleared = await browser.put(PROFILE, json=a_profile(canonical_role_key=None))

    assert chosen.status_code == 200, chosen.text
    assert chosen.json()["canonical_role_key"] == "frontend-engineer"
    assert cleared.json()["canonical_role_key"] is None


async def test_a_handle_typed_on_its_own_is_saved_as_the_whole_address(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(
        PROFILE,
        json=a_profile(
            linkedin_url="in/amina-haddad", github_url="@amina-haddad", portfolio_url="amina.dev"
        ),
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["linkedin_url"] == "https://www.linkedin.com/in/amina-haddad"
    assert saved.json()["github_url"] == "https://github.com/amina-haddad"
    assert saved.json()["portfolio_url"] == "https://amina.dev"


async def test_the_links_go_on_and_come_off_again(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    await browser.put(PROFILE, json=a_profile(github_url="amina-haddad"))
    cleared = await browser.put(PROFILE, json=a_profile(github_url=""))

    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["github_url"] is None
    assert (await my_profile(browser))["github_url"] is None


@pytest.mark.parametrize(
    ("field", "typed"),
    [
        ("linkedin_url", "https://www.linkedin.com/company/aman-relief"),
        ("linkedin_url", "https://github.com/amina-haddad"),
        ("github_url", "https://gitlab.com/amina-haddad"),
        ("portfolio_url", "javascript:alert(1)"),
    ],
)
async def test_an_address_that_is_not_that_kind_of_link_is_refused_where_it_was_typed(
    browser: AsyncClient, mailbox: Mailbox, field: str, typed: str
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.put(PROFILE, json=a_profile(**{field: typed}))

    assert response.status_code == 422, response.text
    problem = response.json()
    assert problem["type"] == "urn:sync:problem:validation-error"
    assert [error["location"] for error in problem["errors"]] == [f"body.{field}"]


async def test_a_canonical_role_the_platform_does_not_know_is_refused_where_it_was_typed(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.put(PROFILE, json=a_profile(canonical_role_key="rockstar-ninja"))

    assert response.status_code == 422
    problem = response.json()
    assert problem["type"] == "urn:sync:problem:unknown-canonical-role"
    assert [error["location"] for error in problem["errors"]] == ["body.canonical_role_key"]


async def test_a_job_with_no_start_year_is_refused_and_the_entry_is_named(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Total experience is one stored number, so a job nobody can date would make it a lie."""
    await a_signed_in_candidate(browser, mailbox)
    undated = a_job((2020, 1), (2021, 6))
    undated["start_year"] = None

    response = await browser.put(PROFILE, json=a_profile(experiences=[undated]))

    assert response.status_code == 422, response.text
    assert [error["location"] for error in response.json()["errors"]] == [
        "body.experiences.0.start_year"
    ]


async def test_a_finished_job_with_no_end_year_is_refused_and_the_entry_is_named(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    unfinished = a_job((2020, 1), None, is_current=False)

    response = await browser.put(PROFILE, json=a_profile(experiences=[unfinished]))

    assert response.status_code == 422, response.text
    assert [error["location"] for error in response.json()["errors"]] == ["body.experiences.0"]


async def test_saving_derives_total_experience_from_the_jobs_that_were_saved(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json=a_profile(experiences=[a_job((2018, 1), (2020, 12))]))

    assert saved.status_code == 200, saved.text
    assert saved.json()["total_experience_years"] == 3


async def test_calculating_total_experience_does_not_save_the_jobs(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    calculated = await browser.post(
        EXPERIENCE_TOTAL,
        json={"experiences": [a_job((2018, 1), (2020, 12))]},
    )

    assert calculated.status_code == 200, calculated.text
    assert calculated.json() == {"total_experience_years": 3}
    assert (await browser.get(PROFILE)).json()["experiences"] == []


async def test_two_jobs_held_at_once_are_one_stretch_of_experience(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    both = [a_job((2018, 1), (2020, 12)), a_job((2018, 1), (2020, 12), company_name="Moonlight")]

    saved = await browser.put(PROFILE, json=a_profile(experiences=both))

    assert saved.json()["total_experience_years"] == 3


async def test_five_months_of_work_round_down_and_six_round_up(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    five = await browser.put(PROFILE, json=a_profile(experiences=[a_job((2020, 1), (2020, 5))]))
    six = await browser.put(PROFILE, json=a_profile(experiences=[a_job((2020, 1), (2020, 6))]))

    assert five.json()["total_experience_years"] == 0
    assert six.json()["total_experience_years"] == 1


async def test_a_candidate_cannot_type_their_own_total_experience(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """A wrong number is corrected by fixing the work history, not by overwriting the number."""
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(
        PROFILE,
        json=a_profile(experiences=[a_job((2020, 1), (2020, 12))], total_experience_years=40),
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["total_experience_years"] == 1


async def test_a_save_answers_with_exactly_what_a_read_would(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    body = a_profile(
        headline="Backend engineer",
        experiences=[a_job((2018, 1), (2020, 12))],
        skills=[{"name": "Python", "years_experience": 4.0}],
        languages=[{"code": "en", "proficiency": "fluent"}],
    )

    saved = await browser.put(PROFILE, json=body)

    assert saved.status_code == 200, saved.text
    assert saved.json() == await my_profile(browser)


async def test_more_precision_than_the_column_keeps_is_rounded_the_way_it_stores(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(
        PROFILE, json=a_profile(skills=[{"name": "Python", "years_experience": 3.25}])
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["skills"] == [{"name": "Python", "years_experience": 3.3}]
    assert (await my_profile(browser))["skills"] == [{"name": "Python", "years_experience": 3.3}]


async def test_correcting_a_date_derives_the_total_again(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await browser.put(PROFILE, json=a_profile(experiences=[a_job((2018, 1), (2020, 12))]))

    corrected = await browser.put(
        PROFILE, json=a_profile(experiences=[a_job((2018, 1), (2019, 12))])
    )

    assert corrected.json()["total_experience_years"] == 2
    assert (await my_profile(browser))["total_experience_years"] == 2
