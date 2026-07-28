from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from sqlalchemy import delete, select

from sync_api.crm.access import ReachableSubject, reachable_application, reachable_candidate
from sync_api.crm.payload import Note, NoteAuthor, NotePage
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import NOTE_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core import get_logger, transaction
from sync_core.models import ApplicationNote, CandidateNote, Profile

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import InstrumentedAttribute

    from sync_api.crm.payload import NewNote, NoteChanges
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

type NoteRow = ApplicationNote | CandidateNote


@dataclass(frozen=True, slots=True)
class Notebook:
    """Where notes about one kind of thing are kept, and how the tenant reaches the thing."""

    note: type[ApplicationNote] | type[CandidateNote]
    subject: InstrumentedAttribute[UUID]
    reachable: ReachableSubject


ABOUT_APPLICATIONS = Notebook(
    note=ApplicationNote,
    subject=ApplicationNote.application_id,
    reachable=reachable_application,
)

ABOUT_CANDIDATES = Notebook(
    note=CandidateNote,
    subject=CandidateNote.candidate_id,
    reachable=reachable_candidate,
)


class NoteService:
    """What one Tenant's recruiters have written down about one kind of thing.

    Every read and every write is scoped by tenant in the query itself, so another tenant's
    note is the same 404 as one that was never written.
    """

    def __init__(self, session: AsyncSession, notebook: Notebook) -> None:
        self._db = session
        self._notebook = notebook

    async def write(self, recruiter: ActingRecruiter, subject_id: UUID, new: NewNote) -> Note:
        await self._notebook.reachable(self._db, recruiter.tenant.id, subject_id)
        note = self._notebook.note(
            tenant_id=recruiter.tenant.id,
            recruiter_id=recruiter.profile.id,
            note_text=new.text,
            **{self._notebook.subject.key: subject_id},
        )
        async with transaction(self._db):
            self._db.add(note)

        logger.info(
            "crm.note_written",
            note_id=str(note.id),
            subject_id=str(subject_id),
            tenant_id=str(recruiter.tenant.id),
        )
        return _as_payload(note, _author(recruiter))

    async def page(
        self,
        recruiter: ActingRecruiter,
        subject_id: UUID,
        *,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> NotePage:
        await self._notebook.reachable(self._db, recruiter.tenant.id, subject_id)
        note = self._notebook.note
        # A notebook is one of two tables, which `select` can only type as their common base.
        found = cast(
            "list[tuple[NoteRow, str]]",
            list(
                (
                    await self._db.execute(
                        newest_first(
                            select(note, Profile.full_name)
                            .join(Profile, Profile.id == note.recruiter_id)
                            .where(
                                self._notebook.subject == subject_id,
                                note.tenant_id == recruiter.tenant.id,
                            ),
                            created_at=note.created_at,
                            id_=note.id,
                            cursor=cursor,
                            limit=limit,
                        )
                    )
                ).tuples()
            ),
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return NotePage(
            items=[
                _as_payload(row, NoteAuthor(id=row.recruiter_id, full_name=full_name))
                for row, full_name in rows
            ],
            next_cursor=next_cursor,
        )

    async def edit(
        self, recruiter: ActingRecruiter, subject_id: UUID, note_id: UUID, changes: NoteChanges
    ) -> Note:
        note, author = await self._own_note(recruiter, subject_id, note_id)
        async with transaction(self._db):
            note.note_text = changes.text

        logger.info("crm.note_edited", note_id=str(note_id), tenant_id=str(recruiter.tenant.id))
        return _as_payload(note, author)

    async def remove(self, recruiter: ActingRecruiter, subject_id: UUID, note_id: UUID) -> None:
        await self._own_note(recruiter, subject_id, note_id)
        note = self._notebook.note
        async with transaction(self._db):
            await self._db.execute(
                delete(note).where(note.id == note_id, note.tenant_id == recruiter.tenant.id)
            )

        logger.info("crm.note_deleted", note_id=str(note_id), tenant_id=str(recruiter.tenant.id))

    async def _own_note(
        self, recruiter: ActingRecruiter, subject_id: UUID, note_id: UUID
    ) -> tuple[NoteRow, NoteAuthor]:
        await self._notebook.reachable(self._db, recruiter.tenant.id, subject_id)
        note = self._notebook.note
        found = cast(
            "tuple[NoteRow, str] | None",
            (
                await self._db.execute(
                    select(note, Profile.full_name)
                    .join(Profile, Profile.id == note.recruiter_id)
                    .where(
                        note.id == note_id,
                        self._notebook.subject == subject_id,
                        note.tenant_id == recruiter.tenant.id,
                    )
                )
            )
            .tuples()
            .first(),
        )
        if found is None:
            raise Problem(
                status=404,
                type=NOTE_NOT_FOUND_PROBLEM_TYPE,
                detail="No note of this tenant has that id.",
            )
        row, full_name = found
        return row, NoteAuthor(id=row.recruiter_id, full_name=full_name)


def _author(recruiter: ActingRecruiter) -> NoteAuthor:
    return NoteAuthor(id=recruiter.profile.id, full_name=recruiter.profile.full_name)


def _cursor(row: tuple[NoteRow, str]) -> Cursor:
    note, _author_name = row
    return Cursor(created_at=note.created_at, id=note.id)


def _as_payload(note: NoteRow, author: NoteAuthor) -> Note:
    return Note(
        id=note.id,
        text=note.note_text,
        author=author,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )
