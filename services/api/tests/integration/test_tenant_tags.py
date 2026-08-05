from __future__ import annotations

from uuid import uuid4

from httpx import AsyncClient

from tests.support.crm import (
    TAG_NAME_TAKEN,
    TAG_NOT_FOUND,
    a_tag,
    create_tag,
    delete_tag,
    rename_tag,
    tags_of,
)


async def test_a_tag_is_created_and_listed(recruiter: AsyncClient) -> None:
    created = await create_tag(recruiter, name="Arabic speaker", scope="candidate")

    assert created.status_code == 201, created.text
    tag = created.json()
    assert tag["name"] == "Arabic speaker"
    assert tag["scope"] == "candidate"
    assert await tags_of(recruiter) == [tag]


async def test_tags_of_both_scopes_live_side_by_side(recruiter: AsyncClient) -> None:
    await a_tag(recruiter, name="Arabic speaker", scope="candidate")
    await a_tag(recruiter, name="Second interview", scope="application")

    listed = {tag["name"]: tag["scope"] for tag in await tags_of(recruiter)}

    assert listed == {"Arabic speaker": "candidate", "Second interview": "application"}


async def test_two_tags_of_one_scope_cannot_share_a_name(recruiter: AsyncClient) -> None:
    await a_tag(recruiter, name="Arabic speaker", scope="candidate")

    refused = await create_tag(recruiter, name="Arabic speaker", scope="candidate")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == TAG_NAME_TAKEN
    assert len(await tags_of(recruiter)) == 1


async def test_two_tags_of_one_scope_cannot_share_a_name_in_another_case_either(
    recruiter: AsyncClient,
) -> None:
    await a_tag(recruiter, name="Arabic speaker", scope="candidate")

    refused = await create_tag(recruiter, name="arabic SPEAKER", scope="candidate")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == TAG_NAME_TAKEN
    assert len(await tags_of(recruiter)) == 1


async def test_a_tag_cannot_be_renamed_onto_a_siblings_name_in_another_case(
    recruiter: AsyncClient,
) -> None:
    await a_tag(recruiter, name="Arabic speaker", scope="candidate")
    second = await a_tag(recruiter, name="Second interview", scope="candidate")

    refused = await rename_tag(recruiter, second["id"], name="ARABIC SPEAKER")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == TAG_NAME_TAKEN


async def test_one_name_can_mean_one_thing_of_a_candidate_and_another_of_an_application(
    recruiter: AsyncClient,
) -> None:
    await a_tag(recruiter, name="Urgent", scope="candidate")

    accepted = await create_tag(recruiter, name="Urgent", scope="application")

    assert accepted.status_code == 201, accepted.text
    assert len(await tags_of(recruiter)) == 2


async def test_a_tag_is_renamed_and_keeps_its_id(recruiter: AsyncClient) -> None:
    tag = await a_tag(recruiter, name="Arabic speaker")

    renamed = await rename_tag(recruiter, tag["id"], "Arabic")

    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["id"] == tag["id"]
    assert [(one["id"], one["name"]) for one in await tags_of(recruiter)] == [(tag["id"], "Arabic")]


async def test_a_tag_cannot_be_renamed_onto_a_siblings_name(recruiter: AsyncClient) -> None:
    await a_tag(recruiter, name="Arabic speaker")
    junior = await a_tag(recruiter, name="Junior")

    refused = await rename_tag(recruiter, junior["id"], "Arabic speaker")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == TAG_NAME_TAKEN


async def test_a_deleted_tag_leaves_the_vocabulary(recruiter: AsyncClient) -> None:
    tag = await a_tag(recruiter, name="Arabic speaker")

    deleted = await delete_tag(recruiter, tag["id"])

    assert deleted.status_code == 204, deleted.text
    assert await tags_of(recruiter) == []


async def test_a_tag_nobody_created_can_be_neither_renamed_nor_deleted(
    recruiter: AsyncClient,
) -> None:
    stranger = uuid4()

    renamed = await rename_tag(recruiter, stranger, "Arabic")
    deleted = await delete_tag(recruiter, stranger)

    assert renamed.status_code == 404, renamed.text
    assert renamed.json()["type"] == TAG_NOT_FOUND
    assert deleted.status_code == 404, deleted.text
