from __future__ import annotations

from typing import Any, Final
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.crm import (
    CANDIDATE_NOT_FOUND,
    a_candidate_nobody_has_met,
    a_searchable_candidate,
    a_tag,
    an_application_to_this_tenant,
    candidate_tags,
    drop_from_pool,
    list_pool,
    pool_of,
    put_tag_on,
    save_to_pool,
    stop_being_searchable,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.search import INVALID_CURSOR, a_candidate_with


async def test_an_applicant_saved_to_the_pool_is_in_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)

    saved = await save_to_pool(recruiter, candidate_id)

    assert saved.status_code == 200, saved.text
    assert saved.json()["candidate_id"] == str(candidate_id)
    assert [member["candidate_id"] for member in await pool_of(recruiter)] == [str(candidate_id)]


async def test_a_searchable_candidate_who_never_applied_can_still_be_saved(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)

    saved = await save_to_pool(recruiter, candidate_id)

    assert saved.status_code == 200, saved.text
    assert saved.json()["full_name"] == "Amina Haddad"


async def test_a_candidate_this_tenant_has_never_met_cannot_be_saved(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    candidate_id = await a_candidate_nobody_has_met(other_browser, mailbox)

    refused = await save_to_pool(recruiter, candidate_id)

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == CANDIDATE_NOT_FOUND
    assert await pool_of(recruiter) == []


async def test_saving_the_same_candidate_twice_leaves_one_pool_entry(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)

    first = await save_to_pool(recruiter, candidate_id)
    again = await save_to_pool(recruiter, candidate_id)

    assert again.status_code == 200, again.text
    assert again.json()["added_at"] == first.json()["added_at"]
    assert len(await pool_of(recruiter)) == 1


async def test_a_candidate_who_stops_being_searchable_can_still_be_dropped(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The pool entry is the Tenant's own record — losing sight of someone must not strand it."""
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)
    await save_to_pool(recruiter, candidate_id)
    await stop_being_searchable(other_browser)

    dropped = await drop_from_pool(recruiter, candidate_id)

    assert dropped.status_code == 204, dropped.text
    assert await pool_of(recruiter) == []


async def test_a_candidate_dropped_from_the_pool_leaves_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    candidate_id = await a_searchable_candidate(other_browser, mailbox, db_session)
    await save_to_pool(recruiter, candidate_id)

    dropped = await drop_from_pool(recruiter, candidate_id)
    again = await drop_from_pool(recruiter, candidate_id)

    assert dropped.status_code == 204, dropped.text
    assert again.status_code == 204, again.text
    assert await pool_of(recruiter) == []


A_BACKEND_OF_EIGHT_YEARS: Final[dict[str, Any]] = {
    "headline": "Backend engineer, Damascus",
    "location_key": "sy-damascus",
    "canonical_role_key": "backend-engineer",
    "experiences": [
        {
            "job_title": "Backend engineer",
            "company_name": "Acme",
            "start_year": 2016,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": None,
        }
    ],
}

A_FRONTEND_OF_TWO_YEARS: Final[dict[str, Any]] = {
    "headline": "Frontend engineer",
    "location_key": "sy-aleppo",
    "canonical_role_key": "frontend-engineer",
    "experiences": [
        {
            "job_title": "Frontend engineer",
            "company_name": "Globex",
            "start_year": 2022,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": None,
        }
    ],
}

A_DESIGNER_OF_THREE_YEARS: Final[dict[str, Any]] = {
    "headline": "Graphic designer",
    "location_key": "fr",
    "canonical_role_key": "graphic-designer",
    "experiences": [
        {
            "job_title": "Designer",
            "company_name": "Studio",
            "start_year": 2021,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": None,
        }
    ],
}

POOLED_KEYS: Final = {
    "candidate_id",
    "full_name",
    "avatar_url",
    "headline",
    "location_name",
    "canonical_role_name",
    "total_experience_years",
    "tags",
    "added_at",
    "is_imported_from_manatal",
    "is_claimed",
}

IN_ORDER: Final[dict[str, tuple[str, str, str]]] = {
    "newest": ("karim", "amal", "rana"),
    "oldest": ("rana", "amal", "karim"),
    "name": ("amal", "karim", "rana"),
    "name_reversed": ("rana", "karim", "amal"),
}


def named(rows: list[dict[str, Any]]) -> list[str]:
    return [row["candidate_id"] for row in rows]


async def a_pool_of_three(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> dict[str, str]:
    """Saved oldest first and named so that no two of the four orders agree — otherwise a sort
    test would pass on the order the rows were already in."""
    people = {
        "rana": await a_candidate_with(
            app, mailbox, session, label="rana", full_name="Rana Haddad", **A_BACKEND_OF_EIGHT_YEARS
        ),
        "amal": await a_candidate_with(
            app, mailbox, session, label="amal", full_name="Amal Nassar", **A_FRONTEND_OF_TWO_YEARS
        ),
        "karim": await a_candidate_with(
            app,
            mailbox,
            session,
            label="karim",
            full_name="Karim Barakat",
            **A_DESIGNER_OF_THREE_YEARS,
        ),
    }
    for person in people.values():
        saved = await save_to_pool(recruiter, person.id)
        assert saved.status_code == 200, saved.text
    return {who: str(person.id) for who, person in people.items()}


async def test_a_pooled_row_says_who_the_candidate_is_today(
    app: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """A recruiter reads the pool to decide who to reach — the facts they decide on are here."""
    person = await a_candidate_with(
        app, mailbox, db_session, label="rana", full_name="Rana Haddad", **A_BACKEND_OF_EIGHT_YEARS
    )
    await save_to_pool(recruiter, person.id)

    row = (await pool_of(recruiter))[0]

    assert set(row) == POOLED_KEYS
    assert row["full_name"] == "Rana Haddad"
    assert row["headline"] == "Backend engineer, Damascus"
    assert row["location_name"] == "Damascus"
    assert row["canonical_role_name"] == "Backend Engineer"
    assert row["total_experience_years"] == 8
    assert row["avatar_url"] is None
    assert row["tags"] == []
    assert row["is_imported_from_manatal"] is False


async def test_a_pooled_row_carries_this_tenants_own_filing_of_them(
    app: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    person = await a_candidate_with(
        app, mailbox, db_session, label="rana", **A_BACKEND_OF_EIGHT_YEARS
    )
    await save_to_pool(recruiter, person.id)
    arabic = await a_tag(recruiter, name="Arabic speaker")
    interviewed = await a_tag(recruiter, name="Interviewed")
    for tag in (interviewed, arabic):
        put_on = await put_tag_on(recruiter, candidate_tags(person.id), tag["id"])
        assert put_on.status_code == 200, put_on.text

    row = (await pool_of(recruiter))[0]

    assert [tag["name"] for tag in row["tags"]] == ["Arabic speaker", "Interviewed"]


async def test_a_rival_tenants_tag_is_in_neither_tenants_reading_of_the_other(
    app: FastAPI,
    recruiter: AsyncClient,
    rival: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Both tenants may save the same person; a Tag is one tenant's word about them, not a fact."""
    person = await a_candidate_with(
        app, mailbox, db_session, label="rana", **A_BACKEND_OF_EIGHT_YEARS
    )
    await save_to_pool(recruiter, person.id)
    await save_to_pool(rival, person.id)
    theirs = await a_tag(rival, name="Rival's own word")
    await put_tag_on(rival, candidate_tags(person.id), theirs["id"])

    ours = (await pool_of(recruiter))[0]

    assert ours["tags"] == []
    assert [tag["name"] for tag in (await pool_of(rival))[0]["tags"]] == ["Rival's own word"]


@pytest.mark.parametrize("sort", list(IN_ORDER))
async def test_the_pool_answers_in_whichever_order_was_asked_for(
    app: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    sort: str,
) -> None:
    people = await a_pool_of_three(app, recruiter, mailbox, db_session)

    assert named(await pool_of(recruiter, sort=sort)) == [people[who] for who in IN_ORDER[sort]]


async def test_asking_for_no_order_is_asking_for_the_most_recently_saved(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_pool_of_three(app, recruiter, mailbox, db_session)

    assert named(await pool_of(recruiter)) == named(await pool_of(recruiter, sort="newest"))


@pytest.mark.parametrize("sort", list(IN_ORDER))
async def test_a_sorted_page_carries_on_where_the_one_before_it_left_off(
    app: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    sort: str,
) -> None:
    people = await a_pool_of_three(app, recruiter, mailbox, db_session)
    seen: list[str] = []
    asked: dict[str, Any] = {"limit": 1, "sort": sort}

    for _ in range(len(people)):
        response = await list_pool(recruiter, **asked)
        assert response.status_code == 200, response.text
        page = response.json()
        seen += named(page["items"])
        if page["next_cursor"] is None:
            break
        asked = {"limit": 1, "sort": sort, "cursor": page["next_cursor"]}

    assert seen == [people[who] for who in IN_ORDER[sort]]


async def test_an_order_the_pool_does_not_offer_is_refused(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_pool_of_three(app, recruiter, mailbox, db_session)

    refused = await list_pool(recruiter, sort="most_experience")

    assert refused.status_code == 422, refused.text


@pytest.mark.parametrize(("issued_by", "resumed_as"), [("name", "newest"), ("newest", "name")])
async def test_a_cursor_from_one_order_is_not_a_cursor_for_another(
    app: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    issued_by: str,
    resumed_as: str,
) -> None:
    """Both ways round, because a timestamp reads perfectly well as a name — and a name order
    resuming from one would quietly serve the first page again as though it were the second."""
    await a_pool_of_three(app, recruiter, mailbox, db_session)
    first = await list_pool(recruiter, limit=1, sort=issued_by)
    carried = first.json()["next_cursor"]

    refused = await list_pool(recruiter, limit=1, sort=resumed_as, cursor=carried)

    assert refused.status_code == 422, refused.text
    assert refused.json()["type"] == INVALID_CURSOR


async def test_a_search_keeps_only_the_people_whose_name_holds_it(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await a_pool_of_three(app, recruiter, mailbox, db_session)

    assert named(await pool_of(recruiter, q="haddad")) == [people["rana"]]


async def test_a_search_reads_a_headline_as_well_as_a_name(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await a_pool_of_three(app, recruiter, mailbox, db_session)

    assert named(await pool_of(recruiter, q="designer")) == [people["karim"]]


async def test_a_search_never_reaches_outside_the_pool(
    app: FastAPI,
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The pool is a list of the Tenant's own saving, and searching it narrows that list."""
    await a_pool_of_three(app, recruiter, mailbox, db_session)
    unsaved = await a_searchable_candidate(other_browser, mailbox, db_session, "unsaved")

    found = await pool_of(recruiter, q="Amina")

    assert found == []
    assert str(unsaved) not in named(await pool_of(recruiter))


async def test_a_wildcard_written_into_a_search_is_only_a_character(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """`%` matches everything to `LIKE` and nobody to a recruiter, who typed a percent sign."""
    await a_pool_of_three(app, recruiter, mailbox, db_session)

    assert await pool_of(recruiter, q="%") == []


async def test_a_search_and_a_sort_answer_together(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await a_pool_of_three(app, recruiter, mailbox, db_session)

    assert named(await pool_of(recruiter, q="engineer", sort="name")) == [
        people["amal"],
        people["rana"],
    ]


async def test_the_pool_says_a_candidate_signed_up_and_has_signed_in(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The ordinary case, so the flags a migrated Candidate carries have something to differ
    from."""
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await save_to_pool(recruiter, candidate_id)

    [member] = await pool_of(recruiter)

    assert member["is_imported_from_manatal"] is False
    assert member["is_claimed"] is True


async def test_the_pool_marks_a_migrated_candidate_nobody_has_claimed(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """What `scripts/manatal-migration` leaves behind: a Candidate the platform made on somebody's
    behalf, whose account nobody has taken over. Both facts have to reach the Recruiter reading
    them, because neither is visible in anything else on the record."""
    await a_searchable_candidate(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await save_to_pool(recruiter, candidate_id)
    await _as_an_unclaimed_import(db_session, candidate_id)

    [member] = await pool_of(recruiter)

    assert member["is_imported_from_manatal"] is True
    assert member["is_claimed"] is False


async def _as_an_unclaimed_import(session: AsyncSession, candidate_id: UUID) -> None:
    """The state the migration script leaves: flagged as Manatal's, and never signed into."""
    await session.execute(
        text("update candidates set is_imported_from_manatal = true where id = :id").bindparams(
            id=candidate_id
        )
    )
    await session.execute(
        text("update auth.users set last_sign_in_at = null where id = :id").bindparams(
            id=candidate_id
        )
    )
    await session.commit()
