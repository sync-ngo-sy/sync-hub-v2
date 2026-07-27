from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class EmailMessage:
    to: str
    subject: str
    html: str
    text: str
    idempotency_key: str


@dataclass(frozen=True, slots=True)
class SentEmail:
    provider: str
    message_id: str


class EmailError(Exception):
    pass


class EmailUnavailableError(EmailError):
    pass


class UnsendableEmailError(EmailError):
    """This message will never leave, however many times it is tried."""


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> SentEmail: ...
