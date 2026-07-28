from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.crm import (
    TAG_SCOPE_MISMATCH,
    a_tag,
    an_application_to_this_tenant,
    application_tags,
    assigned_tags,
    candidate_tags,
    delete_tag,
    put_tag_on,
    take_tag_off,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id


async def test_a_tag_put_on_an_application_reads_back_on_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    tag = await a_tag(recruiter, name="Second interview", scope="application")

    assigned = await put_tag_on(recruiter, application_tags(application["id"]), tag["id"])

    assert assigned.status_code == 200, assigned.text
    assert await assigned_tags(recruiter, application_tags(application["id"])) == [tag]


async def test_a_candidate_scoped_tag_cannot_be_put_on_an_application(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    about_the_person = await a_tag(recruiter, name="Arabic speaker", scope="candidate")

    refused = await put_tag_on(
        recruiter, application_tags(application["id"]), about_the_person["id"]
    )

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == TAG_SCOPE_MISMATCH
    assert await assigned_tags(recruiter, application_tags(application["id"])) == []


async def test_an_application_scoped_tag_cannot_be_put_on_a_candidate(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    about_the_application = await a_tag(recruiter, name="Second interview", scope="application")

    refused = await put_tag_on(recruiter, candidate_tags(candidate_id), about_the_application["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == TAG_SCOPE_MISMATCH


async def test_a_tag_put_on_a_candidate_reads_back_on_them(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    tag = await a_tag(recruiter, name="Arabic speaker", scope="candidate")

    assigned = await put_tag_on(recruiter, candidate_tags(candidate_id), tag["id"])

    assert assigned.status_code == 200, assigned.text
    assert await assigned_tags(recruiter, candidate_tags(candidate_id)) == [tag]


async def test_putting_a_tag_on_twice_leaves_it_on_once(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    tag = await a_tag(recruiter, name="Second interview", scope="application")

    await put_tag_on(recruiter, application_tags(application["id"]), tag["id"])
    again = await put_tag_on(recruiter, application_tags(application["id"]), tag["id"])

    assert again.status_code == 200, again.text
    assert await assigned_tags(recruiter, application_tags(application["id"])) == [tag]


async def test_a_tag_taken_off_is_off_and_taking_it_off_again_is_not_an_error(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    tag = await a_tag(recruiter, name="Second interview", scope="application")
    await put_tag_on(recruiter, application_tags(application["id"]), tag["id"])

    taken_off = await take_tag_off(recruiter, application_tags(application["id"]), tag["id"])
    again = await take_tag_off(recruiter, application_tags(application["id"]), tag["id"])

    assert taken_off.status_code == 204, taken_off.text
    assert again.status_code == 204, again.text
    assert await assigned_tags(recruiter, application_tags(application["id"])) == []


async def test_deleting_a_tag_takes_it_off_everything_it_was_on(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application = await an_application_to_this_tenant(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    on_the_application = await a_tag(recruiter, name="Second interview", scope="application")
    on_the_person = await a_tag(recruiter, name="Arabic speaker", scope="candidate")
    await put_tag_on(recruiter, application_tags(application["id"]), on_the_application["id"])
    await put_tag_on(recruiter, candidate_tags(candidate_id), on_the_person["id"])

    assert (await delete_tag(recruiter, on_the_application["id"])).status_code == 204
    assert (await delete_tag(recruiter, on_the_person["id"])).status_code == 204

    assert await assigned_tags(recruiter, application_tags(application["id"])) == []
    assert await assigned_tags(recruiter, candidate_tags(candidate_id)) == []
