from __future__ import annotations

from typing import TYPE_CHECKING, Final

import resend
from resend.exceptions import ResendError

from sync_comms.email import EmailUnavailableError, SentEmail, UnsendableEmailError
from sync_core import get_logger

if TYPE_CHECKING:
    from sync_comms.email import EmailError, EmailMessage

logger = get_logger(__name__)

PROVIDER: Final = "resend"

#: Resend answering that the request itself is wrong — a malformed address, an unverified
#: sender domain. The same message will be refused however many times it is offered. An
#: auth failure is not in here: a rotated key is the deployment's problem, not the message's.
REJECTING_CODES: Final = frozenset({"400", "422"})


class ResendEmailSender:
    def __init__(self, sender: str) -> None:
        self._sender = sender

    @classmethod
    def build(cls, *, api_key: str, sender: str, timeout_seconds: int) -> ResendEmailSender:
        # The SDK keeps its credentials and its client in module state, so there is one
        # configured provider per process. The worker is that process.
        resend.api_key = api_key
        resend.default_async_http_client = resend.HTTPXClient(timeout=timeout_seconds)
        return cls(sender)

    async def send(self, message: EmailMessage) -> SentEmail:
        try:
            sent = await resend.Emails.send_async(
                {
                    "from": self._sender,
                    "to": [message.to],
                    "subject": message.subject,
                    "html": message.html,
                    "text": message.text,
                },
                {"idempotency_key": message.idempotency_key},
            )
        except ResendError as refused:
            raise _failure(refused) from refused
        return SentEmail(provider=PROVIDER, message_id=sent["id"])


def _failure(error: ResendError) -> EmailError:
    code = str(error.code)
    logger.warning("email.provider_failed", provider=PROVIDER, code=code, kind=error.error_type)
    if code in REJECTING_CODES:
        return UnsendableEmailError(f"Resend refused the message: {error.message}")
    return EmailUnavailableError(f"Resend did not take the message (code {code})")
