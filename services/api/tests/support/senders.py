from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sync_comms import SentEmail

if TYPE_CHECKING:
    from sync_comms import EmailMessage

PROVIDER: Final = "capturing-fake"


class CapturingSender:
    """A provider that keeps what it was handed and dedupes on the idempotency key the way
    Resend does: the same key twice is one message, and the same id back."""

    def __init__(self, *answers: Exception | None) -> None:
        self._answers = list(answers) or [None]
        self.attempts: list[EmailMessage] = []
        self.sent: list[EmailMessage] = []

    @property
    def attempt_count(self) -> int:
        return len(self.attempts)

    def only(self) -> EmailMessage:
        assert len(self.sent) == 1, f"expected one message, the provider holds {len(self.sent)}"
        return self.sent[0]

    async def send(self, message: EmailMessage) -> SentEmail:
        self.attempts.append(message)
        answer = self._answers[min(len(self.attempts) - 1, len(self._answers) - 1)]
        if isinstance(answer, Exception):
            raise answer

        already = next(
            (held for held in self.sent if held.idempotency_key == message.idempotency_key), None
        )
        if already is None:
            self.sent.append(message)
        return SentEmail(provider=PROVIDER, message_id=_message_id(message.idempotency_key))


def _message_id(idempotency_key: str) -> str:
    return f"fake-{idempotency_key}"
