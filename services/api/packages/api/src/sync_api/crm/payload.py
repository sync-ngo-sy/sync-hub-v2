from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from sync_api.text import Line, Paragraph
from sync_core.models import TagScope, TenantTag


class NewTag(BaseModel):
    """A Tag to add to the Tenant's vocabulary."""

    name: Line = Field(description="What it reads as. Unique per scope.", examples=["Arabic"])
    scope: TagScope = Field(
        description="What this Tag may be put on. A Tag never changes scope afterwards."
    )


class TagChanges(BaseModel):
    """What a Tag can still become. Its scope cannot: assignments already rest on it."""

    name: Line


class Tag(BaseModel):
    """One of the Tenant's Tags."""

    id: UUID
    name: str
    scope: TagScope
    created_at: datetime

    @classmethod
    def of(cls, tag: TenantTag) -> Tag:
        return cls(id=tag.id, name=tag.name, scope=tag.scope, created_at=tag.created_at)


class NewNote(BaseModel):
    """A note to keep about a Candidate or an Application."""

    text: Paragraph = Field(description="What the recruiter wants their colleagues to know.")


class NoteChanges(BaseModel):
    """A note as it should now read."""

    text: Paragraph


class NoteAuthor(BaseModel):
    """The Recruiter who wrote a note."""

    id: UUID
    full_name: str


class Note(BaseModel):
    """One note, private to the Tenant it was written in."""

    id: UUID
    text: str
    author: NoteAuthor = Field(description="Who wrote it. Anyone in the Tenant may edit it.")
    created_at: datetime
    updated_at: datetime


class PooledCandidate(BaseModel):
    """One Candidate the Tenant has saved, as its talent pool lists them."""

    candidate_id: UUID
    full_name: str
    headline: str | None = None
    location: str | None = None
    added_at: datetime = Field(description="When this Tenant first saved them.")


class TalentPoolPage(BaseModel):
    """One page of the Tenant's talent pool, most recently saved first."""

    items: list[PooledCandidate]
    next_cursor: str | None = Field(
        default=None,
        description="Send back as `cursor` for the following page. Null on the last page.",
    )


class NotePage(BaseModel):
    """One page of notes, newest first."""

    items: list[Note]
    next_cursor: str | None = Field(
        default=None,
        description="Send back as `cursor` for the following page. Null on the last page.",
    )
