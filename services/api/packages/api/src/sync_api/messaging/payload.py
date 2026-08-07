from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field

from sync_api.messaging.placeholders import KNOWN, as_written, unknown_in
from sync_api.text import Line, Paragraph
from sync_core.models import CommunicationStatus
from sync_core.models import MessageTemplate as MessageTemplateRow

_MAY_USE = f"May use {as_written(KNOWN)}."


def _only_fillable(written: str) -> str:
    """Refuse a placeholder no send could fill, wherever it is written.

    A template hears it as it is saved and an edited send as it is sent, so the vocabulary only
    ever grows where it is declared rather than wherever somebody typed a new name.
    """
    unknown = unknown_in(written)
    if unknown:
        raise ValueError(f"names {as_written(unknown)}, which no message can fill. {_MAY_USE}")
    return written


FillableLine = Annotated[Line, AfterValidator(_only_fillable)]
FillableParagraph = Annotated[Paragraph, AfterValidator(_only_fillable)]


class _TemplateText(BaseModel):
    """The words of a Message template: what a Tenant files it under, and what it says."""

    name: Line = Field(
        description="What the Tenant files it under. Unique per Tenant.",
        examples=["Interview invitation"],
    )
    subject: FillableLine = Field(
        description=f"The subject line. {_MAY_USE}",
        examples=["An interview for {{ job_title }}?"],
    )
    body: FillableParagraph = Field(
        description=f"The message itself, as plain text. {_MAY_USE} A blank line parts paragraphs.",
        examples=[
            "Hi {{ candidate_name }},\n\nWe would like to talk to you about "
            "{{ job_title }}.\n\n{{ tenant_name }}"
        ],
    )


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


class EditedMessage(BaseModel):
    """One send's own words, standing in for the template's. The template is not touched.

    Placeholders are still resolved and still limited to the known names: a recruiter may
    rewrite the sentences for one applicant without inventing anything a send cannot fill.
    """

    subject: FillableLine = Field(
        description=f"The subject line to send in place of the template's. {_MAY_USE}",
        examples=["An interview for Field Coordinator on Tuesday?"],
    )
    body: FillableParagraph = Field(
        description=f"The message to send in place of the template's. {_MAY_USE} "
        "A blank line parts paragraphs.",
        examples=["Hi Amal Haddad,\n\nCould you meet us on Tuesday?\n\nAman Relief"],
    )


class OutgoingMessage(BaseModel):
    """Which of the Tenant's Message templates to write this applicant from, and in what words."""

    template_id: UUID = Field(description="A Message template of the recruiter's own Tenant.")
    edited: EditedMessage | None = Field(
        default=None,
        description="This send's own wording. Null sends the template as it is saved.",
    )


class QueuedMessage(BaseModel):
    """The Communication a recruiter's message became: the resolved words, and where it is."""

    id: UUID
    subject: str = Field(description="The subject as the Candidate will see it, resolved.")
    body: str = Field(description="The message as the Candidate will read it, resolved.")
    status: CommunicationStatus = Field(
        description="`queued`: the sender delivers it, and never rewrites the words above."
    )
    created_at: datetime
