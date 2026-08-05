from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.support.candidates import a_signed_in_candidate
from tests.support.mailbox import Mailbox
from tests.support.messaging import (
    MESSAGE_TEMPLATE_NAME_TAKEN,
    MESSAGE_TEMPLATE_NOT_FOUND,
    VALIDATION_ERROR,
    a_saved_template,
    create_template,
    delete_template,
    read_template,
    revise_template,
    templates_of,
)
from tests.support.tenants import a_teammate


async def test_a_saved_template_keeps_the_words_as_written(recruiter: AsyncClient) -> None:
    saved = await a_saved_template(recruiter)

    assert saved["name"] == "Interview invitation"
    assert saved["subject"] == "An interview for {{ job_title }}?"
    assert "{{ candidate_name }}" in saved["body"], "placeholders are resolved at send, not save"
    assert saved["created_at"] is not None


async def test_the_tenants_templates_are_listed_by_name(recruiter: AsyncClient) -> None:
    await a_saved_template(recruiter, name="Offer")
    await a_saved_template(recruiter, name="Interview invitation")

    assert [template["name"] for template in await templates_of(recruiter)] == [
        "Interview invitation",
        "Offer",
    ]


async def test_one_template_reads_back_whole(recruiter: AsyncClient) -> None:
    saved = await a_saved_template(recruiter)

    response = await read_template(recruiter, saved["id"])

    assert response.status_code == 200, response.text
    assert response.json() == saved


async def test_a_second_template_of_the_same_name_is_refused(recruiter: AsyncClient) -> None:
    await a_saved_template(recruiter)

    clash = await create_template(recruiter)

    assert clash.status_code == 409, clash.text
    assert clash.json()["type"] == MESSAGE_TEMPLATE_NAME_TAKEN


async def test_a_second_template_of_the_same_name_in_another_case_is_refused_too(
    recruiter: AsyncClient,
) -> None:
    saved = await a_saved_template(recruiter)

    clash = await create_template(recruiter, name=saved["name"].upper())

    assert clash.status_code == 409, clash.text
    assert clash.json()["type"] == MESSAGE_TEMPLATE_NAME_TAKEN


async def test_two_tenants_may_each_have_a_template_of_the_same_name(
    recruiter: AsyncClient, rival: AsyncClient
) -> None:
    await a_saved_template(recruiter)

    theirs = await create_template(rival)

    assert theirs.status_code == 201, theirs.text


async def test_a_revision_replaces_every_word_of_it(recruiter: AsyncClient) -> None:
    saved = await a_saved_template(recruiter)

    revised = await revise_template(
        recruiter,
        saved["id"],
        name="Interview invitation (final round)",
        subject="Final round for {{ job_title }}",
        body="Hi {{ candidate_name }}, one more conversation.",
    )

    assert revised.status_code == 200, revised.text
    body = revised.json()
    assert body["id"] == saved["id"]
    assert body["name"] == "Interview invitation (final round)"
    assert body["subject"] == "Final round for {{ job_title }}"
    assert body["body"] == "Hi {{ candidate_name }}, one more conversation."
    assert body["updated_at"] > saved["updated_at"]


async def test_a_revision_onto_another_templates_name_is_refused(recruiter: AsyncClient) -> None:
    await a_saved_template(recruiter, name="Offer")
    saved = await a_saved_template(recruiter, name="Interview invitation")

    clash = await revise_template(recruiter, saved["id"], name="Offer")

    assert clash.status_code == 409, clash.text
    assert clash.json()["type"] == MESSAGE_TEMPLATE_NAME_TAKEN


async def test_a_deleted_template_is_gone(recruiter: AsyncClient) -> None:
    saved = await a_saved_template(recruiter)

    deleted = await delete_template(recruiter, saved["id"])

    assert deleted.status_code == 204, deleted.text
    assert await templates_of(recruiter) == []
    assert (await read_template(recruiter, saved["id"])).status_code == 404


@pytest.mark.parametrize(
    "written",
    [
        "{{ salary }}",
        "{{ Candidate Name }}",
        "{{candidate name}}",
        "{{ candidate_name }} and {{ recruiter_name }}",
    ],
)
async def test_a_placeholder_no_send_could_fill_is_refused_at_save_time(
    recruiter: AsyncClient, written: str
) -> None:
    refused = await create_template(recruiter, body=f"Hello {written}")

    assert refused.status_code == 422, refused.text
    problem = refused.json()
    assert problem["type"] == VALIDATION_ERROR
    assert [error["location"] for error in problem["errors"]] == ["body.body"]


async def test_an_unknown_placeholder_in_the_subject_is_refused_too(
    recruiter: AsyncClient,
) -> None:
    refused = await create_template(recruiter, subject="Your {{ salary }} offer")

    assert refused.status_code == 422, refused.text
    assert [error["location"] for error in refused.json()["errors"]] == ["body.subject"]


async def test_a_revision_is_held_to_the_same_placeholder_rule(recruiter: AsyncClient) -> None:
    saved = await a_saved_template(recruiter)

    refused = await revise_template(recruiter, saved["id"], body="Hi {{ nickname }}")

    assert refused.status_code == 422, refused.text
    assert (await read_template(recruiter, saved["id"])).json()["body"] == saved["body"]


async def test_every_known_placeholder_is_accepted(recruiter: AsyncClient) -> None:
    accepted = await create_template(
        recruiter,
        subject="{{ job_title }} at {{ tenant_name }}",
        body="{{candidate_name}}, {{ job_title  }}, {{tenant_name }} — spacing is the writer's.",
    )

    assert accepted.status_code == 201, accepted.text


async def test_a_template_with_no_placeholders_at_all_is_fine(recruiter: AsyncClient) -> None:
    accepted = await create_template(recruiter, subject="A quick note", body="We will be in touch.")

    assert accepted.status_code == 201, accepted.text


async def test_a_teammate_who_is_no_admin_manages_the_tenants_templates_too(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Templates are the Tenant's, so its recruiters manage them — not only its admins."""
    ours = await a_saved_template(recruiter, name="Offer")
    await a_teammate(recruiter, other_browser, mailbox)

    theirs = await create_template(other_browser, name="Interview invitation")
    revised = await revise_template(other_browser, ours["id"], name="Offer (revised)")

    assert theirs.status_code == 201, theirs.text
    assert revised.status_code == 200, revised.text
    assert [template["name"] for template in await templates_of(other_browser)] == [
        "Interview invitation",
        "Offer (revised)",
    ]


async def test_another_tenants_template_reads_as_absent(
    recruiter: AsyncClient, rival: AsyncClient
) -> None:
    ours = await a_saved_template(recruiter)

    theirs = await read_template(rival, ours["id"])

    assert theirs.status_code == 404, theirs.text
    assert theirs.json()["type"] == MESSAGE_TEMPLATE_NOT_FOUND
    assert await templates_of(rival) == []


async def test_another_tenant_can_neither_rewrite_nor_delete_it(
    recruiter: AsyncClient, rival: AsyncClient
) -> None:
    ours = await a_saved_template(recruiter)

    assert (await revise_template(rival, ours["id"], name="Theirs now")).status_code == 404
    assert (await delete_template(rival, ours["id"])).status_code == 404
    assert (await read_template(recruiter, ours["id"])).json() == ours


async def test_a_template_id_that_never_existed_is_the_same_404(recruiter: AsyncClient) -> None:
    response = await read_template(recruiter, uuid4())

    assert response.status_code == 404, response.text
    assert response.json()["type"] == MESSAGE_TEMPLATE_NOT_FOUND


async def test_a_candidate_has_no_templates_at_all(
    other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(other_browser, mailbox, "outsider")

    refused = await create_template(other_browser)

    assert refused.status_code == 403, refused.text
