"""The one operation a Candidate edits their professional life with.

One GET, one PUT, the whole profile in each — so what the SPA sends back is what it was
given, and a save can never leave headline and experiences describing different people.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.candidates.payload import MAX_ENTRIES
from sync_core.models import CvParsingStatus
from tests.support.candidates import a_signed_in_candidate, sign_in
from tests.support.mailbox import Mailbox
from tests.support.profiles import (
    EMPTY_PROFILE,
    SECTIONS,
    a_profile,
    embedding_jobs,
    give_a_current_cv,
    my_id,
    section_row_counts,
)
from tests.support.tenants import an_admin

PROFILE = "/v1/candidates/me/profile"

#: A profile with every section filled in, in an order chosen to be wrong if anything
#: sorts it — the current job first, the older one second, Python before PostgreSQL.
A_FULL_PROFILE: dict[str, Any] = {
    "headline": "Backend engineer, 8 years",
    "summary": "Builds boring systems that stay up.",
    "location": "Damascus, Syria",
    "preferred_language_code": "ar",
    "is_searchable": False,
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
        {"name": "PostgreSQL", "years_experience": None},
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
}

#: Two complete, incompatible saves, for the tests about which one wins. Every optional
#: field of every entry is spelled out, so either one compares equal to what a GET returns.
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

#: Enough of a profile to touch every child table, for the tests that care about what a
#: save does rather than about what it stores.
SOME_SECTIONS: dict[str, Any] = {
    "experiences": [{"job_title": "Engineer", "start_year": 2020, "is_current": True}],
    "educations": [{"institution": "Damascus University"}],
    "skills": [{"name": "Python", "years_experience": 4.0}],
    "languages": [{"code": "en", "proficiency": "fluent"}],
    "projects": [{"name": "Sync"}],
}


async def test_a_new_candidate_has_an_empty_profile(browser: AsyncClient, mailbox: Mailbox) -> None:
    """Every section present and empty, rather than absent.

    The SPA renders the same form whether or not anything has been filled in, and the GET
    is what it renders from — so an empty profile has to be a whole profile.
    """
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(PROFILE)

    assert response.status_code == 200, response.text
    assert response.json() == EMPTY_PROFILE


async def test_a_saved_profile_comes_back_exactly_as_it_was_sent(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The whole point of the symmetric payload: the SPA can hand back what it was given.

    Order included — the array's order is the candidate's order, and it survives the trip.
    """
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json=A_FULL_PROFILE)

    assert saved.status_code == 200, saved.text
    assert saved.json() == A_FULL_PROFILE
    assert (await browser.get(PROFILE)).json() == A_FULL_PROFILE


async def test_saving_again_replaces_every_section_instead_of_adding_to_it(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """A save is the profile, not a list of edits — so what it leaves out, it deletes.

    Counted in the database rather than read back over HTTP: a replaced experience that
    survived as a row would be invisible in the payload and very visible in the embedding.
    """
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
    """The coalesced queue (supabase ADR-0002): one row per candidate, dirty until embedded.

    Three saves touching every section fire the enqueue trigger dozens of times, and the
    worker still has one candidate to re-embed — from the profile as it finally stands, not
    once per row that changed.
    """
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
    """Screening only ever compares Canonical skills, so a near-miss spelling is not a
    skill the platform can act on — and saying which one is what lets the SPA fix it."""
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


async def test_a_language_the_platform_does_not_know_is_refused_wherever_it_appears(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """A code can arrive in two places, and both are checked in the same breath."""
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.put(
        PROFILE,
        json=a_profile(
            preferred_language_code="zz",
            languages=[
                {"code": "en", "proficiency": "fluent"},
                {"code": "qq", "proficiency": "beginner"},
            ],
        ),
    )

    assert response.status_code == 422
    problem = response.json()
    assert problem["type"] == "urn:sync:problem:unknown-language"
    assert [error["location"] for error in problem["errors"]] == [
        "body.languages.1.code",
        "body.preferred_language_code",
    ]


async def test_a_refused_save_leaves_the_previous_profile_exactly_as_it_was(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Nothing a save can be refused for is discovered after it has started writing.

    Every check that can refuse — the Canonical skills, the language codes, the Searchable
    opt-in — reads rows the request does not own, and all of them run before the first
    delete. So a refusal is not a rollback: there was nothing to roll back.
    """
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    refused = await browser.put(
        PROFILE, json=a_profile(headline="Wiped", skills=[{"name": "Sorcery"}])
    )

    assert refused.status_code == 422
    assert (await browser.get(PROFILE)).json() == A_FULL_PROFILE
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
    """Cross-tenant discovery is the candidate's own decision, and reversible on the spot."""
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(db_session, await my_id(browser))

    opted_in = await browser.put(PROFILE, json=a_profile(is_searchable=True))
    opted_out = await browser.put(PROFILE, json=a_profile(is_searchable=False))

    assert opted_in.status_code == 200, opted_in.text
    assert opted_in.json()["is_searchable"] is True
    assert opted_out.json()["is_searchable"] is False
    assert (await browser.get(PROFILE)).json()["is_searchable"] is False


async def test_two_saves_at_once_leave_one_of_them_whole(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Last-write-wins, not both-writes-merge.

    Two tabs, one candidate, Save in each. Both saves delete every section and write their
    own, so a save that did not take its turn would delete only what the other had already
    committed and leave the two sets of skills side by side — a profile neither tab sent.
    """
    signup = await a_signed_in_candidate(browser, mailbox)
    second_tab = await sign_in(other_browser, signup)
    assert second_tab.status_code == 200, second_tab.text

    saves = await asyncio.gather(
        browser.put(PROFILE, json=ONE_SAVE), other_browser.put(PROFILE, json=THE_OTHER_SAVE)
    )

    assert [save.status_code for save in saves] == [200, 200], [save.text for save in saves]
    assert (await browser.get(PROFILE)).json() in (ONE_SAVE, THE_OTHER_SAVE)


async def test_opting_in_without_a_cv_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    """Global search serves profiles built from a parsed CV, so opting in without one would
    put a candidate in a search index that has nothing of theirs to match on."""
    await a_signed_in_candidate(browser, mailbox)

    refused = await browser.put(
        PROFILE, json=a_profile(headline="Open to work", is_searchable=True)
    )

    assert refused.status_code == 409
    assert refused.json()["type"] == "urn:sync:problem:searchable-needs-cv"
    assert (await browser.get(PROFILE)).json() == EMPTY_PROFILE


async def test_opting_in_before_the_cv_is_parsed_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The half of the rule the CHECK cannot see (migration 02): the CV has to be `ready`.

    A candidate whose upload is still being parsed has no Profile chunks yet, so Global
    search could not match them on anything — the eligibility view would skip them and the
    opt-in would look silently broken.
    """
    await a_signed_in_candidate(browser, mailbox)
    await give_a_current_cv(
        db_session, await my_id(browser), parsing_status=CvParsingStatus.UPLOADED
    )

    refused = await browser.put(PROFILE, json=a_profile(is_searchable=True))

    assert refused.status_code == 409
    assert refused.json()["type"] == "urn:sync:problem:searchable-needs-cv"


async def test_a_recruiter_is_refused_at_the_candidate_routes(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The recruiter half of the platform, refused at the candidate half's door."""
    await an_admin(browser, mailbox)

    read = await browser.get(PROFILE)
    written = await browser.put(PROFILE, json=EMPTY_PROFILE)

    for refused in (read, written):
        assert refused.status_code == 403, refused.text
        assert refused.json()["type"] == "urn:sync:problem:candidate-only"


async def test_a_stranger_is_refused_at_the_candidate_routes(browser: AsyncClient) -> None:
    """No candidate id in the path, so an unauthenticated caller names nobody to read."""
    assert (await browser.get(PROFILE)).status_code == 401
    assert (await browser.put(PROFILE, json=EMPTY_PROFILE)).status_code == 401


async def test_one_candidate_cannot_reach_another_candidates_profile(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """`/me` is the whole of the authorization story: two candidates, two profiles, and no
    request either of them can make that names the other."""
    await a_signed_in_candidate(browser, mailbox, label="first")
    await a_signed_in_candidate(other_browser, mailbox, label="second")
    await browser.put(PROFILE, json=A_FULL_PROFILE)

    assert (await other_browser.get(PROFILE)).json() == EMPTY_PROFILE
    assert await section_row_counts(db_session, await my_id(other_browser)) == dict.fromkeys(
        SECTIONS, 0
    )


#: Every shape the schema's CHECK constraints would refuse, paired with the field a client
#: should be pointed at. Refused here, in the API, so none of them reaches Postgres and
#: comes back as a 500 nobody can act on.
MALFORMED = {
    "an experience that ends before it starts": (
        {"experiences": [{"job_title": "Engineer", "start_year": 2020, "end_year": 2019}]},
        "body.experiences.0",
    ),
    "a current job with an end date": (
        {"experiences": [{"job_title": "Engineer", "is_current": True, "end_year": 2024}]},
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
    "negative years of experience": (
        {"skills": [{"name": "Python", "years_experience": -1}]},
        "body.skills.0.years_experience",
    ),
    "more years of experience than the column holds": (
        {"skills": [{"name": "Python", "years_experience": 1000}]},
        "body.skills.0.years_experience",
    ),
    "more entries than a section holds": (
        {"experiences": [{"job_title": "Engineer"}] * (MAX_ENTRIES + 1)},
        "body.experiences",
    ),
    "the same skill twice": (
        {"skills": [{"name": "Python"}, {"name": "Python"}]},
        "body",
    ),
    "the same language twice": (
        {
            "languages": [
                {"code": "en", "proficiency": "fluent"},
                {"code": "en", "proficiency": "beginner"},
            ]
        },
        "body",
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
    """A form's empty input is how a candidate clears a field, and clearing it means null —
    not a headline that is the empty string and an embedding with a blank line in it."""
    await a_signed_in_candidate(browser, mailbox)

    saved = await browser.put(PROFILE, json=a_profile(headline="   ", summary="", location=None))

    assert saved.status_code == 200, saved.text
    assert saved.json() == EMPTY_PROFILE
