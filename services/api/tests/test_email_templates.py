from __future__ import annotations

from uuid import uuid4

import pytest

from sync_comms import UnsendableEmailError, render
from sync_core.communications import ApplicationConfirmation, ApplicationRejection

AN_APPLICATION_ID = uuid4()


def a_confirmation(**changes: object) -> ApplicationConfirmation:
    return AMINAS_CONFIRMATION.model_copy(update=changes)


AMINAS_CONFIRMATION = ApplicationConfirmation(
    application_id=AN_APPLICATION_ID,
    job_title="Senior Backend Engineer",
    tenant_name="Acme Payments",
    candidate_name="Amina Haddad",
)


def test_the_confirmation_names_the_job_the_tenant_and_the_candidate() -> None:
    rendered = render(ApplicationConfirmation.template_key, a_confirmation())

    assert "Senior Backend Engineer" in rendered.subject
    for part in (rendered.html, rendered.text):
        assert "Amina Haddad" in part
        assert "Acme Payments" in part
        assert "Senior Backend Engineer" in part
        assert str(AN_APPLICATION_ID) in part


def test_a_candidates_own_typing_cannot_reach_the_markup() -> None:
    rendered = render(
        ApplicationConfirmation.template_key,
        a_confirmation(candidate_name="<script>alert('x')</script>"),
    )

    assert "<script>" not in rendered.html
    assert "&lt;script&gt;" in rendered.html


def test_the_plain_text_part_is_never_html_escaped() -> None:
    rendered = render(
        ApplicationConfirmation.template_key, a_confirmation(tenant_name="Marks & Spencer")
    )

    assert "Marks & Spencer" in rendered.text
    assert "Marks &amp; Spencer" in rendered.html


def test_the_rejection_names_the_job_and_the_tenant_without_a_reason() -> None:
    rendered = render(
        ApplicationRejection.template_key,
        ApplicationRejection(
            application_id=AN_APPLICATION_ID,
            job_title="Senior Backend Engineer",
            tenant_name="Acme Payments",
            candidate_name="Amina Haddad",
        ),
    )

    assert "Senior Backend Engineer" in rendered.subject
    for part in (rendered.html, rendered.text):
        assert "Amina Haddad" in part
        assert "Acme Payments" in part
        assert "Senior Backend Engineer" in part


def test_a_template_key_nothing_is_registered_under_is_unsendable() -> None:
    with pytest.raises(UnsendableEmailError):
        render("application-confirmation.v99", a_confirmation())


def test_a_row_that_names_no_template_is_unsendable() -> None:
    with pytest.raises(UnsendableEmailError):
        render(None, a_confirmation())
