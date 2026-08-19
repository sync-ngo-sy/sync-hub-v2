from __future__ import annotations

from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.crm import (
    NOTE_NOT_FOUND,
    a_note,
    an_application_to_this_tenant,
    application_notes,
    candidate_notes,
    delete_note,
    edit_note,
    notes_of,
    write_note,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.tenants import a_teammate


async def test_a_note_on_an_application_reads_back_with_who_wrote_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)

    written = await write_note(
        recruiter, application_notes(application["id"]), "Strong on payments."
    )

    assert written.status_code == 201, written.text
    note = written.json()
    assert note["text"] == "Strong on payments."
    assert note["author"]["full_name"] == "Rana Khalil"
    assert await notes_of(recruiter, application_notes(application["id"])) == [note]


async def test_the_notes_of_an_application_come_back_newest_first(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    await a_note(recruiter, application_notes(application["id"]), "Screened the CV.")
    await a_note(recruiter, application_notes(application["id"]), "Called them back.")

    read = await notes_of(recruiter, application_notes(application["id"]))

    assert [note["text"] for note in read] == ["Called them back.", "Screened the CV."]


async def test_a_note_is_rewritten_in_place_and_keeps_who_wrote_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    note = await a_note(recruiter, application_notes(application["id"]), "Strong on payments.")

    rewritten = await edit_note(
        recruiter, application_notes(application["id"]), note["id"], "Strong on payments and Go."
    )

    assert rewritten.status_code == 200, rewritten.text
    assert rewritten.json()["id"] == note["id"]
    assert rewritten.json()["author"] == note["author"]
    read = await notes_of(recruiter, application_notes(application["id"]))
    assert [one["text"] for one in read] == ["Strong on payments and Go."]


async def test_rewriting_a_note_moves_the_timestamp_the_database_keeps(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    note = await a_note(recruiter, application_notes(application["id"]), "Strong on payments.")

    rewritten = await edit_note(
        recruiter, application_notes(application["id"]), note["id"], "Strong on payments and Go."
    )

    assert rewritten.json()["updated_at"] > note["updated_at"]
    [read] = await notes_of(recruiter, application_notes(application["id"]))
    assert rewritten.json()["updated_at"] == read["updated_at"]


async def test_a_teammate_may_rewrite_and_delete_a_note_they_did_not_write(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    note = await a_note(recruiter, application_notes(application["id"]), "Screened the CV.")
    await a_teammate(recruiter, third_browser, mailbox)

    rewritten = await edit_note(
        third_browser, application_notes(application["id"]), note["id"], "Screened, then called."
    )
    deleted = await delete_note(third_browser, application_notes(application["id"]), note["id"])

    assert rewritten.status_code == 200, rewritten.text
    assert rewritten.json()["author"]["full_name"] == "Rana Khalil"
    assert deleted.status_code == 204, deleted.text
    assert await notes_of(recruiter, application_notes(application["id"])) == []


async def test_a_note_this_tenant_never_wrote_can_be_neither_read_nor_rewritten(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    stranger = uuid4()

    rewritten = await edit_note(
        recruiter, application_notes(application["id"]), stranger, "Never written."
    )
    deleted = await delete_note(recruiter, application_notes(application["id"]), stranger)

    assert rewritten.status_code == 404, rewritten.text
    assert rewritten.json()["type"] == NOTE_NOT_FOUND
    assert deleted.status_code == 404, deleted.text


async def test_a_note_about_a_candidate_reads_back_on_them(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)

    written = await write_note(recruiter, candidate_notes(candidate_id), "Worth keeping warm.")

    assert written.status_code == 201, written.text
    assert await notes_of(recruiter, candidate_notes(candidate_id)) == [written.json()]


async def test_notes_about_a_candidate_and_notes_on_their_application_stay_apart(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await a_note(recruiter, application_notes(application["id"]), "Answered every question.")
    await a_note(recruiter, candidate_notes(candidate_id), "Worth keeping warm.")

    on_the_application = await notes_of(recruiter, application_notes(application["id"]))
    about_the_person = await notes_of(recruiter, candidate_notes(candidate_id))

    assert [note["text"] for note in on_the_application] == ["Answered every question."]
    assert [note["text"] for note in about_the_person] == ["Worth keeping warm."]


async def test_a_note_with_a_null_byte_is_saved_without_it_not_crashed(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The pentest's own repro: the byte Postgres refuses used to reach it and become a 500."""
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)

    written = await write_note(
        recruiter, application_notes(application["id"]), "Strong on\x00payments."
    )

    assert written.status_code == 201, written.text
    assert written.json()["text"] == "Strong onpayments."


async def test_a_note_of_nothing_but_control_characters_is_refused(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)

    refused = await write_note(recruiter, application_notes(application["id"]), "\x00\x01")

    assert refused.status_code == 422, refused.text


async def test_a_multi_line_note_keeps_its_line_breaks(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    written = "Strong on payments.\r\nWorth a call today."

    note = await a_note(recruiter, application_notes(application["id"]), written)

    assert note["text"] == written
