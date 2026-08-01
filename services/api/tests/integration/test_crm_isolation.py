from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.crm import (
    APPLICATION_NOT_FOUND,
    NOTE_NOT_FOUND,
    TAG_NOT_FOUND,
    a_note,
    a_tag,
    application_notes,
    application_tags,
    assigned_tags,
    candidate_notes,
    candidate_tags,
    delete_note,
    delete_tag,
    drop_from_pool,
    edit_note,
    list_assigned_tags,
    list_notes,
    notes_of,
    one_candidate_who_applied_to_both,
    pool_of,
    put_tag_on,
    save_to_pool,
    tags_of,
    take_tag_off,
)
from tests.support.mailbox import Mailbox


async def test_a_rival_tenant_sees_none_of_the_notes_tags_or_pool_entries(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    on_the_person = await a_tag(recruiter, name="Arabic speaker", scope="candidate")
    await a_note(recruiter, application_notes(both.here["id"]), "Strong on payments.")
    await a_note(recruiter, candidate_notes(both.candidate_id), "Worth keeping warm.")
    await put_tag_on(recruiter, candidate_tags(both.candidate_id), on_the_person["id"])
    await save_to_pool(recruiter, both.candidate_id)

    assert await tags_of(rival) == []
    assert await notes_of(rival, candidate_notes(both.candidate_id)) == []
    assert await assigned_tags(rival, candidate_tags(both.candidate_id)) == []
    assert await pool_of(rival) == []
    assert await notes_of(rival, application_notes(both.there["id"])) == []


async def test_a_rival_tenant_cannot_reach_the_application_the_notes_are_on(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    note = await a_note(recruiter, application_notes(both.here["id"]), "Strong on payments.")

    read = await list_notes(rival, application_notes(both.here["id"]))
    rewritten = await edit_note(rival, application_notes(both.here["id"]), note["id"], "Theirs.")
    deleted = await delete_note(rival, application_notes(both.here["id"]), note["id"])

    assert read.status_code == 404, read.text
    assert read.json()["type"] == APPLICATION_NOT_FOUND
    assert rewritten.status_code == 404, rewritten.text
    assert deleted.status_code == 404, deleted.text
    assert [
        one["text"] for one in await notes_of(recruiter, application_notes(both.here["id"]))
    ] == ["Strong on payments."]


async def test_a_rival_tenant_cannot_reach_a_note_through_its_own_application(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    note = await a_note(recruiter, application_notes(both.here["id"]), "Strong on payments.")

    rewritten = await edit_note(rival, application_notes(both.there["id"]), note["id"], "Theirs.")
    deleted = await delete_note(rival, application_notes(both.there["id"]), note["id"])

    assert rewritten.status_code == 404, rewritten.text
    assert deleted.status_code == 404, deleted.text
    assert len(await notes_of(recruiter, application_notes(both.here["id"]))) == 1


async def test_a_rival_tenant_cannot_rewrite_a_note_about_a_candidate_they_both_reach(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The sharpest vector: both tenants legitimately reach the Candidate, so only the note's
    own tenant scoping stands between one tenant's record and the other."""
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    note = await a_note(recruiter, candidate_notes(both.candidate_id), "Worth keeping warm.")

    rewritten = await edit_note(rival, candidate_notes(both.candidate_id), note["id"], "Theirs.")
    deleted = await delete_note(rival, candidate_notes(both.candidate_id), note["id"])

    assert rewritten.status_code == 404, rewritten.text
    assert rewritten.json()["type"] == NOTE_NOT_FOUND
    assert deleted.status_code == 404, deleted.text
    assert [
        one["text"] for one in await notes_of(recruiter, candidate_notes(both.candidate_id))
    ] == ["Worth keeping warm."]


async def test_a_rival_tenant_cannot_touch_the_tags_on_an_application_of_its_own_applicant(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    ours = await a_tag(recruiter, name="Second interview", scope="application")
    await put_tag_on(recruiter, application_tags(both.here["id"]), ours["id"])

    read = await list_assigned_tags(rival, application_tags(both.here["id"]))
    borrowed = await put_tag_on(rival, application_tags(both.there["id"]), ours["id"])
    taken_off = await take_tag_off(rival, application_tags(both.here["id"]), ours["id"])

    assert read.status_code == 404, read.text
    assert read.json()["type"] == APPLICATION_NOT_FOUND
    assert borrowed.status_code == 404, borrowed.text
    assert borrowed.json()["type"] == TAG_NOT_FOUND
    assert taken_off.status_code == 404, taken_off.text
    assert await assigned_tags(recruiter, application_tags(both.here["id"])) == [ours]
    assert await assigned_tags(rival, application_tags(both.there["id"])) == []


async def test_a_rival_tenant_can_neither_use_nor_delete_another_tenants_tag(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    ours = await a_tag(recruiter, name="Arabic speaker", scope="candidate")
    await put_tag_on(recruiter, candidate_tags(both.candidate_id), ours["id"])

    borrowed = await put_tag_on(rival, candidate_tags(both.candidate_id), ours["id"])
    taken_off = await take_tag_off(rival, candidate_tags(both.candidate_id), ours["id"])
    deleted = await delete_tag(rival, ours["id"])

    assert borrowed.status_code == 404, borrowed.text
    assert borrowed.json()["type"] == TAG_NOT_FOUND
    assert taken_off.status_code == 404, taken_off.text
    assert deleted.status_code == 404, deleted.text
    assert await assigned_tags(recruiter, candidate_tags(both.candidate_id)) == [ours]


async def test_two_tenants_can_file_the_same_candidate_under_the_same_name_apart(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    ours = await a_tag(recruiter, name="Urgent", scope="candidate")
    theirs = await a_tag(rival, name="Urgent", scope="candidate")

    await put_tag_on(recruiter, candidate_tags(both.candidate_id), ours["id"])
    await put_tag_on(rival, candidate_tags(both.candidate_id), theirs["id"])

    assert await assigned_tags(recruiter, candidate_tags(both.candidate_id)) == [ours]
    assert await assigned_tags(rival, candidate_tags(both.candidate_id)) == [theirs]


async def test_one_tenant_dropping_a_candidate_leaves_the_other_tenants_pool_alone(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    both = await one_candidate_who_applied_to_both(
        recruiter, rival, other_browser, mailbox, db_session
    )
    await save_to_pool(recruiter, both.candidate_id)
    await save_to_pool(rival, both.candidate_id)

    dropped = await drop_from_pool(rival, both.candidate_id)

    assert dropped.status_code == 204, dropped.text
    assert [member["candidate_id"] for member in await pool_of(recruiter)] == [
        str(both.candidate_id)
    ]
    assert await pool_of(rival) == []
