from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final
from uuid import UUID, uuid4

from sqlalchemy import delete, exists, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from sync_core import Storage, get_logger, transaction
from sync_core.models import (
    AccountType,
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateProject,
    CandidateSkill,
    CandidateTagAssignment,
    Cv,
    CvParsingStatus,
    Language,
    LanguageProficiency,
    Location,
    ManatalImportEntry,
    ManatalImportEntryState,
    ManatalImportJob,
    ManatalImportJobKind,
    ManatalImportJobStatus,
    Note,
    Profile,
    SkillTaxonomy,
    TagScope,
    TalentPoolMember,
    TenantTag,
    User,
)
from sync_core.storage import cv_object_path
from sync_manatal.auth import AddressTakenError, ManatalAuth, ManatalAuthError
from sync_manatal.client import (
    ManatalCandidate,
    ManatalClient,
    ManatalError,
    ManatalUnavailableError,
    ResumeMissingError,
)
from sync_manatal.links import linkedin_address
from sync_manatal.proficiency import proficiency_of
from sync_manatal.profiles import (
    NOTHING_FROM_MANATAL,
    FromManatal,
    ParsedProfile,
    linkedin_from_parse,
    profile_from,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database, Settings

logger = get_logger(__name__)

MAX_SKILLS: Final = 50
SETTLED: Final = frozenset(
    {
        ManatalImportEntryState.PUBLISHED,
        ManatalImportEntryState.NO_EMAIL,
        ManatalImportEntryState.NO_RESUME,
        ManatalImportEntryState.ALREADY_REGISTERED,
    }
)
RETRYABLE: Final = frozenset({ManatalImportEntryState.PENDING, ManatalImportEntryState.FAILED})


@dataclass(frozen=True, slots=True)
class ManatalImportResult:
    kind: ManatalImportJobKind
    manatal_candidate_id: str | None = None


class ManatalImporting:
    def __init__(
        self,
        database: Database,
        storage: Storage,
        settings: Settings,
        *,
        manatal: ManatalClient | None = None,
        auth: ManatalAuth | None = None,
    ) -> None:
        self._database = database
        self._storage = storage
        self._settings = settings
        self._manatal = manatal
        self._auth = auth

    @classmethod
    def build(cls, database: Database, storage: Storage, settings: Settings) -> ManatalImporting:
        token = settings.manatal_api_token
        manatal = (
            ManatalClient.build(
                base_url=settings.manatal_api_base_url,
                token=token.get_secret_value(),
                timeout_seconds=settings.manatal_timeout_seconds,
                page_size=settings.manatal_page_size,
            )
            if token is not None
            else None
        )
        return cls(database, storage, settings, manatal=manatal, auth=ManatalAuth.build(settings))

    async def aclose(self) -> None:
        if self._manatal is not None:
            await self._manatal.aclose()
        if self._auth is not None:
            await self._auth.aclose()

    async def plan(self, tenant_id: UUID, recruiter_id: UUID) -> ManatalImportResult:
        manatal = _manatal(self)
        everyone = await manatal.everyone(limit=self._settings.manatal_limit)
        async with self._database.session() as session, transaction(session):
            enqueued = 0
            for candidate in everyone:
                if not candidate.external_id:
                    continue
                entry = await _upsert_entry(session, tenant_id, candidate)
                if entry.state not in RETRYABLE:
                    continue
                if await _has_pending_job(
                    session, tenant_id, ManatalImportJobKind.IMPORT, candidate.external_id
                ):
                    continue
                await _enqueue(
                    session,
                    tenant_id=tenant_id,
                    recruiter_id=recruiter_id,
                    kind=ManatalImportJobKind.IMPORT,
                    manatal_candidate_id=candidate.external_id,
                )
                enqueued += 1
        logger.info(
            "manatal.plan_complete",
            tenant_id=str(tenant_id),
            seen=len(everyone),
            enqueued=enqueued,
        )
        return ManatalImportResult(ManatalImportJobKind.PLAN)

    async def import_one(
        self, tenant_id: UUID, recruiter_id: UUID, manatal_candidate_id: str
    ) -> ManatalImportResult:
        manatal = _manatal(self)
        auth = _auth(self)
        candidate = await manatal.candidate(manatal_candidate_id)
        async with self._database.session() as session, transaction(session):
            entry = await _entry(session, tenant_id, manatal_candidate_id)
            if entry is not None and entry.state in SETTLED | {ManatalImportEntryState.IMPORTED}:
                return ManatalImportResult(
                    ManatalImportJobKind.IMPORT, manatal_candidate_id=manatal_candidate_id
                )
            if not candidate.email:
                await _settle(
                    session,
                    tenant_id,
                    manatal_candidate_id,
                    candidate,
                    ManatalImportEntryState.NO_EMAIL,
                )
                return ManatalImportResult(
                    ManatalImportJobKind.IMPORT, manatal_candidate_id=manatal_candidate_id
                )
            try:
                resume = await manatal.resume(candidate)
            except ResumeMissingError:
                await _settle(
                    session,
                    tenant_id,
                    manatal_candidate_id,
                    candidate,
                    ManatalImportEntryState.NO_RESUME,
                )
                return ManatalImportResult(
                    ManatalImportJobKind.IMPORT, manatal_candidate_id=manatal_candidate_id
                )

            file_hash = hashlib.sha256(resume.content).hexdigest()
            candidate_id = entry.candidate_id if entry is not None else None
            provisioned = False
            locations = await _location_keys(session)

            if candidate_id is None:
                if await _address_is_taken(session, candidate.email):
                    await _settle(
                        session,
                        tenant_id,
                        manatal_candidate_id,
                        candidate,
                        ManatalImportEntryState.ALREADY_REGISTERED,
                    )
                    return ManatalImportResult(
                        ManatalImportJobKind.IMPORT, manatal_candidate_id=manatal_candidate_id
                    )
                try:
                    candidate_id = await auth.create_account(email=candidate.email)
                except AddressTakenError:
                    await _settle(
                        session,
                        tenant_id,
                        manatal_candidate_id,
                        candidate,
                        ManatalImportEntryState.ALREADY_REGISTERED,
                    )
                    return ManatalImportResult(
                        ManatalImportJobKind.IMPORT, manatal_candidate_id=manatal_candidate_id
                    )
                provisioned = True
                try:
                    await _create_candidate(
                        session,
                        candidate_id,
                        candidate,
                        locations,
                    )
                except BaseException:
                    await session.commit()
                    await _undo(auth, candidate_id)
                    raise

            stored = await _store_cv(
                session,
                candidate_id,
                display_name=resume.filename,
                file_hash=file_hash,
                media_type=resume.media_type,
            )
            if stored.is_new:
                try:
                    await self._storage.upload(
                        stored.storage_path, resume.content, media_type=resume.media_type
                    )
                except BaseException:
                    await session.execute(delete(Cv).where(Cv.id == stored.cv_id))
                    if provisioned:
                        await session.commit()
                        await _undo(auth, candidate_id)
                    raise

            await session.execute(
                pg_insert(TalentPoolMember)
                .values(
                    tenant_id=tenant_id,
                    candidate_id=candidate_id,
                    added_by_recruiter_id=recruiter_id,
                )
                .on_conflict_do_nothing()
            )
            if candidate.tags:
                await _apply_tags(session, tenant_id, recruiter_id, candidate_id, candidate.tags)
            note = _note_from(candidate)
            if note:
                await _keep_note(session, tenant_id, recruiter_id, candidate_id, note)

            await _settle(
                session,
                tenant_id,
                manatal_candidate_id,
                candidate,
                ManatalImportEntryState.IMPORTED,
                candidate_id=candidate_id,
                cv_id=stored.cv_id,
                file_hash=file_hash,
            )
        return ManatalImportResult(ManatalImportJobKind.IMPORT, manatal_candidate_id=manatal_candidate_id)

    async def publish_one(
        self, tenant_id: UUID, recruiter_id: UUID, manatal_candidate_id: str
    ) -> ManatalImportResult:
        async with self._database.session() as session, transaction(session):
            entry = await _require_entry(session, tenant_id, manatal_candidate_id)
            if entry.state != ManatalImportEntryState.IMPORTED:
                return ManatalImportResult(
                    ManatalImportJobKind.PUBLISH, manatal_candidate_id=manatal_candidate_id
                )
            if entry.candidate_id is None or entry.cv_id is None:
                raise ManatalError(f"entry {manatal_candidate_id} has no candidate or cv")
            cv = await session.get(Cv, entry.cv_id)
            if cv is None or cv.parsing_status != CvParsingStatus.READY or cv.parsed_cv_data is None:
                return ManatalImportResult(
                    ManatalImportJobKind.PUBLISH, manatal_candidate_id=manatal_candidate_id
                )
            if not await _profile_is_empty(session, entry.candidate_id):
                entry.state = ManatalImportEntryState.PUBLISHED
                entry.updated_at = datetime.now(UTC)
                return ManatalImportResult(
                    ManatalImportJobKind.PUBLISH, manatal_candidate_id=manatal_candidate_id
                )

            taxonomy, languages = await _vocabularies(session)
            profile = profile_from(
                cv.parsed_cv_data,
                candidate_id=entry.candidate_id,
                taxonomy=taxonomy,
                languages=languages,
            )
            if not profile.is_worth_publishing:
                entry.state = ManatalImportEntryState.PUBLISHED
                entry.updated_at = datetime.now(UTC)
                return ManatalImportResult(
                    ManatalImportJobKind.PUBLISH, manatal_candidate_id=manatal_candidate_id
                )

            await _publish_profile(
                session,
                entry.candidate_id,
                entry.cv_id,
                profile,
                FromManatal(
                    position=entry.position,
                    company=entry.company,
                    degree=entry.degree,
                    university=entry.university,
                    graduation_year=entry.graduation_year,
                    english=entry.english,
                ),
                linkedin_url=linkedin_from_parse(cv.parsed_cv_data),
            )
            entry.state = ManatalImportEntryState.PUBLISHED
            entry.updated_at = datetime.now(UTC)
        return ManatalImportResult(ManatalImportJobKind.PUBLISH, manatal_candidate_id=manatal_candidate_id)

    async def give_up(
        self,
        session: AsyncSession,
        *,
        tenant_id: UUID,
        kind: ManatalImportJobKind,
        manatal_candidate_id: str | None,
        reason: str,
    ) -> None:
        if kind == ManatalImportJobKind.PLAN or manatal_candidate_id is None:
            return
        entry = await _entry(session, tenant_id, manatal_candidate_id)
        if entry is None or entry.state in SETTLED:
            return
        entry.state = ManatalImportEntryState.FAILED
        entry.error_message = reason[:500]
        entry.attempts = entry.attempts + 1
        entry.updated_at = datetime.now(UTC)


async def enqueue_plan(session: AsyncSession, *, tenant_id: UUID, recruiter_id: UUID) -> UUID:
    if await _has_pending_job(session, tenant_id, ManatalImportJobKind.PLAN, None):
        existing = await session.scalar(
            select(ManatalImportJob.id).where(
                ManatalImportJob.tenant_id == tenant_id,
                ManatalImportJob.kind == ManatalImportJobKind.PLAN,
                ManatalImportJob.status.in_(
                    (ManatalImportJobStatus.PENDING, ManatalImportJobStatus.PROCESSING)
                ),
            )
        )
        if existing is not None:
            return existing
    return await _enqueue(
        session, tenant_id=tenant_id, recruiter_id=recruiter_id, kind=ManatalImportJobKind.PLAN
    )


async def enqueue_publish_batch(
    session: AsyncSession, *, tenant_id: UUID, recruiter_id: UUID
) -> int:
    rows = (
        await session.scalars(
            select(ManatalImportEntry.manatal_candidate_id).where(
                ManatalImportEntry.tenant_id == tenant_id,
                ManatalImportEntry.state == ManatalImportEntryState.IMPORTED,
            )
        )
    ).all()
    enqueued = 0
    for manatal_candidate_id in rows:
        if await _has_pending_job(
            session, tenant_id, ManatalImportJobKind.PUBLISH, manatal_candidate_id
        ):
            continue
        await _enqueue(
            session,
            tenant_id=tenant_id,
            recruiter_id=recruiter_id,
            kind=ManatalImportJobKind.PUBLISH,
            manatal_candidate_id=manatal_candidate_id,
        )
        enqueued += 1
    return enqueued


def _manatal(importer: ManatalImporting) -> ManatalClient:
    if importer._manatal is None:
        raise ManatalError("MANATAL_API_TOKEN is not configured")
    return importer._manatal


def _auth(importer: ManatalImporting) -> ManatalAuth:
    if importer._auth is None:
        raise ManatalAuthError("Supabase auth is not configured")
    return importer._auth


@dataclass(frozen=True, slots=True)
class _StoredCv:
    cv_id: UUID
    storage_path: str
    is_new: bool


async def _enqueue(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    recruiter_id: UUID,
    kind: ManatalImportJobKind,
    manatal_candidate_id: str | None = None,
) -> UUID:
    job_id = uuid4()
    await session.execute(
        insert(ManatalImportJob).values(
            id=job_id,
            tenant_id=tenant_id,
            recruiter_id=recruiter_id,
            kind=kind,
            manatal_candidate_id=manatal_candidate_id,
        )
    )
    return job_id


async def _has_pending_job(
    session: AsyncSession,
    tenant_id: UUID,
    kind: ManatalImportJobKind,
    manatal_candidate_id: str | None,
) -> bool:
    filters = [
        ManatalImportJob.tenant_id == tenant_id,
        ManatalImportJob.kind == kind,
        ManatalImportJob.status.in_(
            (ManatalImportJobStatus.PENDING, ManatalImportJobStatus.PROCESSING)
        ),
    ]
    if manatal_candidate_id is None:
        filters.append(ManatalImportJob.manatal_candidate_id.is_(None))
    else:
        filters.append(ManatalImportJob.manatal_candidate_id == manatal_candidate_id)
    return bool(await session.scalar(select(exists().where(*filters))))


async def _entry(
    session: AsyncSession, tenant_id: UUID, manatal_candidate_id: str
) -> ManatalImportEntry | None:
    return await session.get(ManatalImportEntry, (tenant_id, manatal_candidate_id))


async def _require_entry(
    session: AsyncSession, tenant_id: UUID, manatal_candidate_id: str
) -> ManatalImportEntry:
    entry = await _entry(session, tenant_id, manatal_candidate_id)
    if entry is None:
        raise ManatalError(f"no ledger entry for Manatal candidate {manatal_candidate_id}")
    return entry


async def _upsert_entry(
    session: AsyncSession, tenant_id: UUID, candidate: ManatalCandidate
) -> ManatalImportEntry:
    metadata = _entry_metadata(candidate)
    await session.execute(
        pg_insert(ManatalImportEntry)
        .values(tenant_id=tenant_id, manatal_candidate_id=candidate.external_id, **metadata)
        .on_conflict_do_update(
            index_elements=[ManatalImportEntry.tenant_id, ManatalImportEntry.manatal_candidate_id],
            set_=metadata,
            where=ManatalImportEntry.state.in_(tuple(RETRYABLE)),
        )
    )
    return await _require_entry(session, tenant_id, candidate.external_id)


async def _settle(
    session: AsyncSession,
    tenant_id: UUID,
    manatal_candidate_id: str,
    candidate: ManatalCandidate,
    state: ManatalImportEntryState,
    *,
    candidate_id: UUID | None = None,
    cv_id: UUID | None = None,
    file_hash: str | None = None,
) -> None:
    metadata = _entry_metadata(candidate)
    await session.execute(
        pg_insert(ManatalImportEntry)
        .values(
            tenant_id=tenant_id,
            manatal_candidate_id=manatal_candidate_id,
            state=state,
            candidate_id=candidate_id,
            cv_id=cv_id,
            file_hash=file_hash,
            error_message=None,
            **metadata,
        )
        .on_conflict_do_update(
            index_elements=[ManatalImportEntry.tenant_id, ManatalImportEntry.manatal_candidate_id],
            set_={
                "state": state,
                "candidate_id": candidate_id,
                "cv_id": cv_id,
                "file_hash": file_hash,
                "error_message": None,
                **metadata,
                "updated_at": func.now(),
            },
        )
    )


def _entry_metadata(candidate: ManatalCandidate) -> dict[str, object]:
    return {
        "full_name": candidate.full_name,
        "email": candidate.email,
        "position": candidate.headline,
        "company": candidate.current_company,
        "degree": candidate.latest_degree or _custom_degree(candidate),
        "university": candidate.latest_university,
        "graduation_year": candidate.graduation_year,
        "english": proficiency_of(candidate.english_spoken, candidate.english_written),
    }


def _custom_degree(candidate: ManatalCandidate) -> str | None:
    custom = candidate.raw.get("custom_fields")
    if not isinstance(custom, dict):
        return None
    for key in ("highestdegree", "highest_degree"):
        stated = custom.get(key)
        if isinstance(stated, str) and stated.strip():
            return stated.strip()
    return None


def _note_from(candidate: ManatalCandidate) -> str:
    written = [candidate.description] if candidate.description else []
    custom = candidate.raw.get("custom_fields")
    if isinstance(custom, dict):
        skip = {"linkedinprofile", "linkedin", "linkedin_url"}
        written += [
            f"{key.replace('_', ' ')}: {value}"
            for key, value in custom.items()
            if value and key.lower() not in skip
        ]
    if not written:
        return ""
    return f"From Manatal:\n{'\n'.join(written)}"


async def _location_keys(session: AsyncSession) -> dict[str, str]:
    rows = await session.execute(select(Location.key, Location.name))
    return {name.strip().lower(): key for key, name in rows.all()}


def _location_key_of(typed: str | None, taxonomy: dict[str, str]) -> str | None:
    if not typed:
        return None
    for part in reversed([piece.strip() for piece in typed.split(",") if piece.strip()]):
        found = taxonomy.get(part.lower())
        if found:
            return found
    return None


async def _address_is_taken(session: AsyncSession, email: str) -> bool:
    return bool(await session.scalar(select(exists().where(User.email == email))))


async def _create_candidate(
    session: AsyncSession,
    candidate_id: UUID,
    candidate: ManatalCandidate,
    locations: dict[str, str],
) -> None:
    linkedin = (
        linkedin_address(candidate.linkedin_url or "") if candidate.linkedin_url else None
    )
    session.add(
        Profile(
            id=candidate_id,
            account_type=AccountType.CANDIDATE,
            full_name=candidate.full_name or candidate.email,
            phone=candidate.phone,
            avatar_url=candidate.picture_url,
        )
    )
    session.add(
        Candidate(
            id=candidate_id,
            headline=candidate.headline,
            location_key=_location_key_of(candidate.location, locations),
            linkedin_url=linkedin,
            unmapped_skills=list(candidate.skills),
            is_imported_from_manatal=True,
        )
    )


async def _store_cv(
    session: AsyncSession,
    candidate_id: UUID,
    *,
    display_name: str,
    file_hash: str,
    media_type: str,
) -> _StoredCv:
    existing = await session.scalar(
        select(Cv.id).where(
            Cv.candidate_id == candidate_id,
            Cv.file_hash == file_hash,
            Cv.deleted_at.is_(None),
        )
    )
    if existing is not None:
        return _StoredCv(
            cv_id=existing,
            storage_path=cv_object_path(candidate_id, existing, media_type),
            is_new=False,
        )
    cv_id = uuid4()
    storage_path = cv_object_path(candidate_id, cv_id, media_type)
    session.add(
        Cv(
            id=cv_id,
            candidate_id=candidate_id,
            display_name=display_name,
            storage_path=storage_path,
            file_hash=file_hash,
        )
    )
    return _StoredCv(cv_id=cv_id, storage_path=storage_path, is_new=True)


async def _apply_tags(
    session: AsyncSession,
    tenant_id: UUID,
    recruiter_id: UUID,
    candidate_id: UUID,
    tags: Sequence[str],
) -> None:
    for name in tags:
        tag_id = await session.scalar(
            select(TenantTag.id).where(
                TenantTag.tenant_id == tenant_id,
                TenantTag.scope == TagScope.CANDIDATE,
                TenantTag.name == name,
            )
        )
        if tag_id is None:
            created = TenantTag(tenant_id=tenant_id, name=name, scope=TagScope.CANDIDATE)
            session.add(created)
            await session.flush()
            tag_id = created.id
        await session.execute(
            pg_insert(CandidateTagAssignment)
            .values(
                tenant_id=tenant_id,
                candidate_id=candidate_id,
                tag_id=tag_id,
                added_by_recruiter_id=recruiter_id,
            )
            .on_conflict_do_nothing()
        )


async def _keep_note(
    session: AsyncSession,
    tenant_id: UUID,
    recruiter_id: UUID,
    candidate_id: UUID,
    note_text: str,
) -> None:
    already = await session.scalar(
        select(exists().where(
            Note.tenant_id == tenant_id,
            Note.candidate_id == candidate_id,
            Note.note_text == note_text,
        ))
    )
    if already:
        return
    session.add(
        Note(
            tenant_id=tenant_id,
            candidate_id=candidate_id,
            recruiter_id=recruiter_id,
            note_text=note_text,
        )
    )


async def _profile_is_empty(session: AsyncSession, candidate_id: UUID) -> bool:
    filled = await session.scalar(
        select(
            exists().where(CandidateExperience.candidate_id == candidate_id)
            | exists().where(CandidateEducation.candidate_id == candidate_id)
            | exists().where(CandidateSkill.candidate_id == candidate_id)
            | exists().where(CandidateLanguage.candidate_id == candidate_id)
            | exists().where(CandidateProject.candidate_id == candidate_id)
        )
    )
    return not filled


async def _vocabularies(session: AsyncSession) -> tuple[dict[str, UUID], list[str]]:
    skills = await session.execute(select(SkillTaxonomy.id, SkillTaxonomy.canonical_name))
    codes = (await session.scalars(select(Language.code))).all()
    return (
        {name.lower(): skill_id for skill_id, name in skills.all()},
        list(codes),
    )


async def _publish_profile(
    session: AsyncSession,
    candidate_id: UUID,
    cv_id: UUID,
    profile: ParsedProfile,
    from_manatal: FromManatal,
    *,
    linkedin_url: str | None,
) -> None:
    await session.execute(
        select(Candidate.id).where(Candidate.id == candidate_id).with_for_update()
    )
    existing_skills = await session.scalar(
        select(Candidate.unmapped_skills).where(Candidate.id == candidate_id)
    )
    merged = _merged(list(existing_skills or ()), profile.unmapped_skills)
    await session.execute(
        update(Candidate)
        .where(Candidate.id == candidate_id)
        .values(
            headline=profile.headline,
            summary=profile.summary,
            unmapped_skills=merged,
            linkedin_url=func.coalesce(Candidate.linkedin_url, linkedin_url),
            current_cv_id=func.coalesce(Candidate.current_cv_id, cv_id),
            is_searchable=True,
        )
    )
    experiences = profile.experiences or from_manatal.experiences(candidate_id)
    educations = profile.educations or from_manatal.educations(candidate_id)
    languages = profile.languages or from_manatal.languages(candidate_id)
    for row in experiences:
        session.add(
            CandidateExperience(
                candidate_id=row[0],
                sort_order=row[1],
                job_title=row[2],
                company_name=row[3],
                start_year=row[4],
                start_month=row[5],
                end_year=row[6],
                end_month=row[7],
                is_current=row[8],
                description=row[9],
            )
        )
    for row in educations:
        session.add(
            CandidateEducation(
                candidate_id=row[0],
                sort_order=row[1],
                institution=row[2],
                degree=row[3],
                field_of_study=row[4],
                graduation_year=row[5],
                description=row[6],
            )
        )
    for row in profile.skills:
        session.add(
            CandidateSkill(
                candidate_id=row[0],
                sort_order=row[1],
                taxonomy_id=row[2],
                years_experience=row[3],
            )
        )
    for row in languages:
        session.add(
            CandidateLanguage(
                candidate_id=row[0],
                sort_order=row[1],
                language_code=row[2],
                proficiency=LanguageProficiency(row[3]),
            )
        )
    for row in profile.projects:
        session.add(
            CandidateProject(
                candidate_id=row[0],
                sort_order=row[1],
                name=row[2],
                description=row[3],
                project_url=row[4],
                repository_url=row[5],
                start_year=row[6],
                start_month=row[7],
                end_year=row[8],
                end_month=row[9],
            )
        )


def _merged(kept: Sequence[str], added: Sequence[str]) -> list[str]:
    seen: dict[str, str] = {}
    for skill in (*kept, *added):
        seen.setdefault(skill.strip().lower(), skill.strip())
    return [skill for skill in seen.values() if skill][:MAX_SKILLS]


async def _undo(auth: ManatalAuth, candidate_id: UUID) -> None:
    try:
        await auth.delete_account(candidate_id)
    except ManatalAuthError as broke:
        logger.warning("manatal.undo_failed", candidate_id=str(candidate_id), error=str(broke))
