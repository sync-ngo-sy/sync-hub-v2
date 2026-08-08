from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sync_parsers import ParsedExperience, ParsedSkill
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import a_read_cv, an_uploaded_cv
from tests.support.extractors import FakeExtractor, a_parse
from tests.support.profiles import (
    SECTIONS,
    a_filled_profile,
    a_profile,
    a_saved_profile,
    my_id,
    my_profile,
    my_profile_draft,
    save_profile,
    section_row_counts,
)
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database, Storage
    from tests.support.mailbox import Mailbox


async def a_draft_of(browser: AsyncClient, cv_id: str) -> dict[str, Any]:
    response = await my_profile_draft(browser, cv_id)
    assert response.status_code == 200, response.text
    draft: dict[str, Any] = response.json()
    return draft


async def test_a_candidate_with_no_profile_yet_gets_the_whole_cv(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await a_read_cv(browser, database, storage)

    draft = await a_draft_of(browser, cv["id"])

    assert draft["full_name"] == "Amina Haddad"
    assert draft["phone"] == "+963 11 555 0134"
    assert draft["headline"] == "Backend engineer, 8 years"
    # A Location is chosen from a list, so it stays the Candidate's rather than the CV's.
    assert draft["location_key"] is None
    assert [entry["job_title"] for entry in draft["experiences"]] == [
        "Senior Backend Engineer",
        "Backend Engineer",
    ]
    assert [entry["institution"] for entry in draft["educations"]] == ["Damascus University"]
    assert [entry["code"] for entry in draft["languages"]] == ["ar", "en"]
    assert [entry["name"] for entry in draft["projects"]] == ["Sync"]
    assert draft["unmapped_skills"] == ["Vibe-Driven Development"]


async def test_every_skill_the_cv_newly_names_arrives_with_no_years(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """The parse carries figures for both of these, and the draft still asks the candidate: a
    number a recruiter filters on is theirs to state."""
    await a_signed_in_candidate(browser, mailbox)
    cv = await a_read_cv(browser, database, storage)

    draft = await a_draft_of(browser, cv["id"])

    assert [(skill["name"], skill["years_experience"]) for skill in draft["skills"]] == [
        ("Python", None),
        ("PostgreSQL", None),
    ]


async def test_a_re_import_keeps_the_years_the_candidate_typed(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """Skills merge because they have a natural key. Discarding the years the candidate typed
    would be the most expensive thing a re-import could do."""
    await a_signed_in_candidate(browser, mailbox)
    await a_saved_profile(
        browser, a_filled_profile(skills=[{"name": "Python", "years_experience": 3.5}])
    )
    naming_one_more = a_parse(
        skills=[
            ParsedSkill(name="Python", years_experience=8.0),
            ParsedSkill(name="PostgreSQL", years_experience=7.0),
        ]
    )

    cv = await a_read_cv(browser, database, storage, extractor=FakeExtractor(naming_one_more))

    draft = await a_draft_of(browser, cv["id"])
    assert [(skill["name"], skill["years_experience"]) for skill in draft["skills"]] == [
        ("Python", 3.5),
        ("PostgreSQL", None),
    ]


async def test_the_settings_come_from_the_candidate_and_never_from_the_cv(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """The address a CV gives is free text naming no Location, so the candidate's choice stands."""
    await a_signed_in_candidate(browser, mailbox)
    await a_saved_profile(browser, a_filled_profile(location_key="sy-aleppo"))
    cv = await a_read_cv(browser, database, storage)

    draft = await a_draft_of(browser, cv["id"])

    assert draft["location_key"] == "sy-aleppo"
    assert draft["is_searchable"] is False


async def test_the_draft_persists_nothing_until_it_is_put_back(
    browser: AsyncClient,
    mailbox: Mailbox,
    database: Database,
    storage: Storage,
    db_session: AsyncSession,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    cv = await a_read_cv(browser, database, storage)

    draft = await a_draft_of(browser, cv["id"])

    assert await my_profile(browser) == a_profile()
    assert await section_row_counts(db_session, candidate_id) == dict.fromkeys(SECTIONS, 0)
    saved = await a_saved_profile(browser, _with_years_filled_in(draft))
    assert saved["headline"] == "Backend engineer, 8 years"
    assert [skill["name"] for skill in saved["skills"]] == ["Python", "PostgreSQL"]
    assert saved["unmapped_skills"] == ["Vibe-Driven Development"]


async def test_a_cv_that_has_not_been_read_has_no_draft(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)

    refused = await my_profile_draft(browser, cv["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:cv-not-ready"


async def test_another_candidates_cv_has_no_draft_for_you(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox, "owner")
    theirs = await a_read_cv(browser, database, storage)
    await a_signed_in_candidate(other_browser, mailbox, "stranger")

    refused = await my_profile_draft(other_browser, theirs["id"])

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:cv-not-found"


async def test_a_cv_that_never_existed_is_a_404(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    assert (await my_profile_draft(browser, uuid4())).status_code == 404


async def test_the_draft_is_only_for_candidates(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)

    refused = await my_profile_draft(browser, uuid4())

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:candidate-only"


def _with_years_filled_in(draft: dict[str, Any]) -> dict[str, Any]:
    """What the review screen does before it can save: the candidate types the blanks."""
    return {
        **draft,
        "skills": [{**skill, "years_experience": 5.0} for skill in draft["skills"]],
    }


async def test_a_cv_proposes_a_canonical_role_into_the_draft(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """The one judgement the parse is asked for, and still only a proposal: the draft is a form
    the candidate confirms, changes or clears before anything is stored."""
    await a_signed_in_candidate(browser, mailbox)
    cv = await a_read_cv(browser, database, storage)

    draft = await a_draft_of(browser, cv["id"])

    assert draft["canonical_role_key"] == "backend-engineer"


async def test_a_cv_that_supports_no_role_proposes_none(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await a_read_cv(
        browser, database, storage, extractor=FakeExtractor(a_parse(canonical_role=None))
    )

    draft = await a_draft_of(browser, cv["id"])

    assert draft["canonical_role_key"] is None


async def test_a_role_the_taxonomy_does_not_have_is_not_proposed(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """A key nobody could save is worse than no proposal at all."""
    await a_signed_in_candidate(browser, mailbox)
    cv = await a_read_cv(
        browser, database, storage, extractor=FakeExtractor(a_parse(canonical_role="rockstar"))
    )

    draft = await a_draft_of(browser, cv["id"])

    assert draft["canonical_role_key"] is None


async def test_a_vague_cv_leaves_the_role_the_candidate_already_claimed(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await a_saved_profile(browser, a_profile(canonical_role_key="ui-ux-designer"))
    cv = await a_read_cv(
        browser, database, storage, extractor=FakeExtractor(a_parse(canonical_role=None))
    )

    draft = await a_draft_of(browser, cv["id"])

    assert draft["canonical_role_key"] == "ui-ux-designer"


async def test_a_job_the_cv_never_dated_reaches_the_draft_undated(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """Like a skill with no years: the candidate dates it at review, and the profile will not
    save until they have. Dropping it would throw away the job title the CV did give."""
    await a_signed_in_candidate(browser, mailbox)
    undated = a_parse(
        experiences=[
            ParsedExperience(
                job_title="Intern",
                company_name="Damascus Chamber of Commerce",
                start_year=None,
                start_month=None,
                end_year=None,
                end_month=None,
                is_current=False,
                description=None,
            )
        ]
    )
    cv = await a_read_cv(browser, database, storage, extractor=FakeExtractor(undated))

    draft = await a_draft_of(browser, cv["id"])

    assert draft["experiences"] == [
        {
            "job_title": "Intern",
            "company_name": "Damascus Chamber of Commerce",
            "start_year": None,
            "start_month": None,
            "end_year": None,
            "end_month": None,
            "is_current": False,
            "description": None,
        }
    ]

    refused = await save_profile(browser, a_profile(experiences=draft["experiences"]))
    assert refused.status_code == 422, refused.text
