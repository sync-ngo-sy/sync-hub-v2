from __future__ import annotations

import os
from uuid import uuid4

import pytest

from sync_comms import EmailMessage, UnsendableEmailError, render
from sync_comms.resend_sender import PROVIDER, ResendEmailSender
from sync_core import get_settings
from sync_core.communications import ApplicationConfirmation

pytestmark = [
    pytest.mark.email_live,
    pytest.mark.skipif(
        not os.environ.get("SYNC_RESEND_API_KEY"),
        reason="SYNC_RESEND_API_KEY is not set",
    ),
]

#: Resend's own sink: it accepts and discards, so a live run never writes to a person.
A_TEST_RECIPIENT = "delivered@resend.dev"


@pytest.fixture
def sender() -> ResendEmailSender:
    settings = get_settings()
    assert settings.resend_api_key is not None
    return ResendEmailSender.build(
        api_key=settings.resend_api_key.get_secret_value(),
        sender=settings.email_from,
        timeout_seconds=settings.email_timeout_seconds,
    )


def a_confirmation_to(recipient: str, *, idempotency_key: str) -> EmailMessage:
    rendered = render(
        ApplicationConfirmation.template_key,
        ApplicationConfirmation(
            application_id=uuid4(),
            job_title="Senior Backend Engineer",
            tenant_name="Acme Payments",
            candidate_name="Amina Haddad",
        ),
    )
    return EmailMessage(
        to=recipient,
        subject=rendered.subject,
        html=rendered.html,
        text=rendered.text,
        idempotency_key=idempotency_key,
    )


async def test_the_real_provider_takes_the_rendered_confirmation(
    sender: ResendEmailSender,
) -> None:
    sent = await sender.send(a_confirmation_to(A_TEST_RECIPIENT, idempotency_key=_a_key()))

    assert sent.provider == PROVIDER
    assert sent.message_id


async def test_the_real_provider_treats_one_key_as_one_message(sender: ResendEmailSender) -> None:
    key = _a_key()

    first = await sender.send(a_confirmation_to(A_TEST_RECIPIENT, idempotency_key=key))
    again = await sender.send(a_confirmation_to(A_TEST_RECIPIENT, idempotency_key=key))

    assert first.message_id == again.message_id


async def test_an_address_the_real_provider_refuses_is_unsendable(
    sender: ResendEmailSender,
) -> None:
    with pytest.raises(UnsendableEmailError):
        await sender.send(a_confirmation_to("not-an-address", idempotency_key=_a_key()))


def _a_key() -> str:
    return f"live-confirmation:{uuid4()}"
