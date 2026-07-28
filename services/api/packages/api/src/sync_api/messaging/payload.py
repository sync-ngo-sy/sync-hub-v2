from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from sync_api.messaging.placeholders import SYNTAX, unknown_in
from sync_api.text import Line, Paragraph
from sync_core.models import CommunicationStatus
from sync_core.models import MessageTemplate as MessageTemplateRow


class _TemplateText(BaseModel):
    """The words of a Message template, and the one rule they have to obey.

    A placeholder no send could fill is refused here rather than at send time: a template is
    saved once and sent from for months, so the recruiter who wrote the typo is the one who
    should hear about it.
    """

    name: Line = Field(
        description="What the Tenant files it under. Unique per Tenant.",
        examples=["Interview invitation"],
    )
    subject: Line = Field(
        description=f"The subject line. May use {SYNTAX}.",
        examples=["An interview for {{ job_title }}?"],
    )
    body: Paragraph = Field(
        description=f"The message itself, as plain text. May use {SYNTAX}. A blank line parts "
        "paragraphs.",
        examples=[
            "Hi {{ candidate_name }},\n\nWe would like to talk to you about "
            "{{ job_title }}.\n\n{{ tenant_name }}"
        ],
    )

    @field_validator("subject", "body")
    @classmethod
    def _fillable(cls, written: str) -> str:
        unknown = unknown_in(written)
        if unknown:
            named = ", ".join(f"`{{{{ {name} }}}}`" for name in unknown)
            raise ValueError(f"names {named}, which no message can fill. Use only {SYNTAX}.")
        return written


class NewMessageTemplate(_TemplateText):
    """A reusable message to save under a name."""


class MessageTemplateChanges(_TemplateText):
    """A Message template as it should now read — all of it, and the last write wins."""


class MessageTemplate(BaseModel):
    """One of the Tenant's Message templates, as it was saved."""

    id: UUID
    name: str
    subject: str
    body: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def of(cls, template: MessageTemplateRow) -> MessageTemplate:
        return cls(
            id=template.id,
            name=template.name,
            subject=template.subject,
            body=template.body,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )


class OutgoingMessage(BaseModel):
    """Which of the Tenant's Message templates to write this applicant from."""

    template_id: UUID = Field(description="A Message template of the recruiter's own Tenant.")


class SentMessage(BaseModel):
    """The Communication a recruiter's message became: the resolved words, and where it is."""

    id: UUID
    subject: str = Field(description="The subject as the Candidate will see it, resolved.")
    body: str = Field(description="The message as the Candidate will read it, resolved.")
    status: CommunicationStatus = Field(
        description="`queued` on the way out. The sender settles it, and never rewrites the "
        "words above."
    )
    created_at: datetime
