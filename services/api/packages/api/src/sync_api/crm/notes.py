from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import Select, delete, select

from sync_api.crm.access import ReachableSubject, reachable_application, reachable_candidate
from sync_api.crm.payload import Note, NoteAuthor, NotePage
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import NOTE_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core import get_logger, transaction
from sync_core.models import Note as NoteRow
from sync_core.models import Profile

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import InstrumentedAttribute

    from sync_api.crm.payload import NewNote, NoteChanges
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Subject:
    """Which of a note's two subjects this is, and how the tenant reaches one of them."""

    column: InstrumentedAttribute[UUID | None]
    reachable: ReachableSubject


ABOUT_APPLICATIONS = Subject(column=NoteRow.application_id, reachable=reachable_application)

ABOUT_CANDIDATES = Subject(column=NoteRow.candidate_id, reachable=reachable_candidate)


class NoteService:
    """What one Tenant's recruiters have written down about one kind of subject.

    Every read and every write is scoped by tenant *and* by subject in the query itself, so
    another tenant's note — and a note about the other subject — is the same 404 as one that
    was never written.
    """

    def __init__(self, session: AsyncSession, subject: Subject) -> None:
        self._db = session
        self._subject = subject

    async def write(self, recruiter: ActingRecruiter, subject_id: UUID, new: NewNote) -> Note:
        await self._subject.reachable(self._db, recruiter.tenant.id, subject_id)
        note = NoteRow(
            tenant_id=recruiter.tenant.id,
            recruiter_id=recruiter.profile.id,
            note_text=new.text,
            **{self._subject.column.key: subject_id},
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
        await self._subject.reachable(self._db, recruiter.tenant.id, subject_id)
        found = list(
            (
                await self._db.execute(
                    newest_first(
                        self._notes_about(recruiter, subject_id),
                        created_at=NoteRow.created_at,
                        id_=NoteRow.id,
                        cursor=cursor,
                        limit=limit,
                    )
                )
            ).tuples()
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
        await self._db.refresh(note)  # `updated_at` is the trigger's to write, not ours
        return _as_payload(note, author)

    async def remove(self, recruiter: ActingRecruiter, subject_id: UUID, note_id: UUID) -> None:
        await self._subject.reachable(self._db, recruiter.tenant.id, subject_id)
        async with transaction(self._db):
            deleted = await self._db.scalars(
                delete(NoteRow)
                .where(
                    NoteRow.id == note_id,
                    self._subject.column == subject_id,
                    NoteRow.tenant_id == recruiter.tenant.id,
                )
                .returning(NoteRow.id)
            )
            if deleted.one_or_none() is None:
                raise _no_such_note()

        logger.info("crm.note_deleted", note_id=str(note_id), tenant_id=str(recruiter.tenant.id))

    def _notes_about(
        self, recruiter: ActingRecruiter, subject_id: UUID
    ) -> Select[tuple[NoteRow, str]]:
        return (
            select(NoteRow, Profile.full_name)
            .join(Profile, Profile.id == NoteRow.recruiter_id)
            .where(
                self._subject.column == subject_id,
                NoteRow.tenant_id == recruiter.tenant.id,
            )
        )

    async def _own_note(
        self, recruiter: ActingRecruiter, subject_id: UUID, note_id: UUID
    ) -> tuple[NoteRow, NoteAuthor]:
        await self._subject.reachable(self._db, recruiter.tenant.id, subject_id)
        found = (
            (
                await self._db.execute(
                    self._notes_about(recruiter, subject_id).where(NoteRow.id == note_id)
                )
            )
            .tuples()
            .first()
        )
        if found is None:
            raise _no_such_note()
        row, full_name = found
        return row, NoteAuthor(id=row.recruiter_id, full_name=full_name)


def _no_such_note() -> Problem:
    return Problem(
        status=404,
        type=NOTE_NOT_FOUND_PROBLEM_TYPE,
        detail="No note of this tenant has that id.",
    )


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
