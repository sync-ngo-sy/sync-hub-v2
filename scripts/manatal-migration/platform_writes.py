"""Every row this migration writes, as SQL against the platform's own schema.

Raw SQL on purpose. Importing the platform's models would tie a one-off script to a codebase that
keeps moving, and would mean editing that codebase to make room for it. The cost is that this file
has to stay true to the schema by hand — so it writes only what an ordinary signup and an ordinary
CV upload write, and nothing exotic.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID, uuid4

import asyncpg

from links import linkedin_address

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from profile_rows import Profile

#: What `cv_object_path` produces in the platform: the candidate's own folder, the CV's id, and
#: the extension the media type implies.
#: What the platform caps a profile section at.
MAX_SKILLS: Final = 50

EXTENSIONS: Final[dict[str, str]] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


class PlatformError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class Importer:
    """Who the migration runs as: a Recruiter, and the Tenant their row names."""

    recruiter_id: UUID
    tenant_id: UUID


@dataclass(frozen=True, slots=True)
class StoredCv:
    cv_id: UUID
    storage_path: str
    is_new: bool


@dataclass(frozen=True, slots=True)
class ParseState:
    status: str
    parsed: dict[str, Any] | None

    @property
    def is_ready(self) -> bool:
        return self.status == "ready" and self.parsed is not None


def dsn_of(database_url: str) -> str:
    """asyncpg speaks plain `postgresql://`; the platform's own URL names its driver."""
    return database_url.replace("+asyncpg", "", 1)


async def connect(database_url: str) -> asyncpg.Pool:
    pool = await asyncpg.create_pool(dsn_of(database_url), min_size=1, max_size=8)
    if pool is None:  # pragma: no cover — asyncpg raises rather than returning None
        raise PlatformError("could not open a connection pool")
    return pool


async def importer(pool: asyncpg.Pool, recruiter_id: UUID) -> Importer:
    row = await pool.fetchrow(
        "select id, tenant_id from recruiters where id = $1 and is_active", recruiter_id
    )
    if row is None:
        raise PlatformError(
            f"no active recruiter {recruiter_id} to bring these candidates in as — "
            "MANATAL_RECRUITER_ID has to name one"
        )
    return Importer(recruiter_id=row["id"], tenant_id=row["tenant_id"])


async def location_keys(pool: asyncpg.Pool) -> dict[str, str]:
    """The location taxonomy, keyed by lowercased name.

    Manatal stores a typed string — "Mersin, Turkey" — and this platform stores a key. Matching
    is on the name, exactly, one comma-separated part at a time: "Turkey" resolves, "Mersin"
    does not, and nothing is invented in between. A candidate whose location does not resolve
    keeps none rather than a wrong one.
    """
    rows = await pool.fetch("select key, name from locations")
    return {row["name"].strip().lower(): row["key"] for row in rows}


def location_key_of(typed: str | None, taxonomy: Mapping[str, str]) -> str | None:
    if not typed:
        return None
    for part in reversed([piece.strip() for piece in typed.split(",") if piece.strip()]):
        found = taxonomy.get(part.lower())
        if found:
            return found
    return None


async def create_candidate(
    pool: asyncpg.Pool,
    account_id: UUID,
    *,
    full_name: str,
    headline: str | None,
    phone: str | None = None,
    avatar_url: str | None = None,
    location_key: str | None = None,
    linkedin_url: str | None = None,
    unmapped_skills: Sequence[str] = (),
) -> None:
    """The two rows a Candidate is, in one transaction, as signup writes them.

    Flagged as Manatal's: nothing else in the schema would say so, and a Recruiter
    reading one of these needs to know that nobody typed it.
    """
    async with pool.acquire() as connection, connection.transaction():
        await connection.execute(
            """
            insert into profiles (id, account_type, full_name, phone, avatar_url)
            values ($1, 'candidate', $2, $3, $4)
            """,
            account_id,
            full_name,
            phone,
            avatar_url,
        )
        await connection.execute(
            """
            insert into candidates
                (id, headline, location_key, linkedin_url, unmapped_skills, is_imported_from_manatal)
            values ($1, $2, $3, $4, $5, true)
            """,
            account_id,
            headline,
            location_key,
            linkedin_url,
            list(unmapped_skills),
        )


async def store_cv(
    pool: asyncpg.Pool,
    candidate_id: UUID,
    *,
    display_name: str,
    file_hash: str,
    media_type: str,
) -> StoredCv:
    """The `cvs` row, and the path its file belongs at.

    Inserting it is what enqueues the parse: `ingest_on_upload` does that, exactly as it does for
    an upload. A file this Candidate already has is recognised by the partial unique index the
    platform puts on `(candidate_id, file_hash)`.
    """
    existing = await pool.fetchval(
        "select id from cvs where candidate_id = $1 and file_hash = $2 and deleted_at is null",
        candidate_id,
        file_hash,
    )
    if existing is not None:
        return StoredCv(
            cv_id=existing, storage_path=_path(candidate_id, existing, media_type), is_new=False
        )

    cv_id = uuid4()
    storage_path = _path(candidate_id, cv_id, media_type)
    try:
        await pool.execute(
            """
            insert into cvs (id, candidate_id, display_name, storage_path, file_hash)
            values ($1, $2, $3, $4, $5)
            """,
            cv_id,
            candidate_id,
            display_name,
            storage_path,
            file_hash,
        )
    except asyncpg.UniqueViolationError:
        won = await pool.fetchval(
            "select id from cvs where candidate_id = $1 and file_hash = $2 and deleted_at is null",
            candidate_id,
            file_hash,
        )
        if won is None:
            raise
        return StoredCv(cv_id=won, storage_path=_path(candidate_id, won, media_type), is_new=False)
    return StoredCv(cv_id=cv_id, storage_path=storage_path, is_new=True)


async def remove_cv_row(pool: asyncpg.Pool, cv_id: UUID) -> None:
    """Undoing a `cvs` row whose file never made it into storage. Deleting it takes the parse the
    trigger queued with it."""
    await pool.execute("delete from cvs where id = $1", cv_id)


async def add_to_talent_pool(pool: asyncpg.Pool, given: Importer, candidate_id: UUID) -> None:
    await pool.execute(
        """
        insert into talent_pool_members (tenant_id, candidate_id, added_by_recruiter_id)
        values ($1, $2, $3)
        on conflict do nothing
        """,
        given.tenant_id,
        candidate_id,
        given.recruiter_id,
    )


async def keep_note(
    pool: asyncpg.Pool, given: Importer, candidate_id: UUID, note_text: str
) -> None:
    """What a recruiter wrote about them in Manatal, kept as what it is here: a Note, private to
    the Tenant that wrote it. Not the candidate's own summary — nobody asked them."""
    await pool.execute(
        """
        insert into notes (tenant_id, candidate_id, recruiter_id, note_text)
        select $1, $2, $3, $4
        where not exists (
            select 1 from notes
             where tenant_id = $1 and candidate_id = $2 and note_text = $4
        )
        """,
        given.tenant_id,
        candidate_id,
        given.recruiter_id,
        note_text,
    )


async def apply_tags(
    pool: asyncpg.Pool, given: Importer, candidate_id: UUID, tags: Sequence[str]
) -> None:
    """Manatal's labels become this Tenant's own Tags, created on first sight."""
    for name in tags:
        async with pool.acquire() as connection, connection.transaction():
            tag_id = await connection.fetchval(
                """
                insert into tenant_tags (tenant_id, name, scope) values ($1, $2, 'candidate')
                on conflict (tenant_id, scope, name) do update set name = excluded.name
                returning id
                """,
                given.tenant_id,
                name,
            )
            await connection.execute(
                """
                insert into candidate_tag_assignments
                    (tenant_id, candidate_id, tag_id, added_by_recruiter_id)
                values ($1, $2, $3, $4)
                on conflict do nothing
                """,
                given.tenant_id,
                candidate_id,
                tag_id,
                given.recruiter_id,
            )


async def parse_state(pool: asyncpg.Pool, cv_id: UUID) -> ParseState:
    row = await pool.fetchrow(
        "select parsing_status::text as status, parsed_cv_data from cvs where id = $1", cv_id
    )
    if row is None:
        return ParseState(status="gone", parsed=None)
    raw = row["parsed_cv_data"]
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    return ParseState(status=row["status"], parsed=parsed if isinstance(parsed, dict) else None)


async def vocabularies(
    pool: asyncpg.Pool,
) -> tuple[dict[str, UUID], list[str]]:
    """The platform's Canonical skills and language codes, keyed for lookup."""
    skills = await pool.fetch("select id, canonical_name from skill_taxonomy")
    codes = await pool.fetch("select code from languages")
    return (
        {row["canonical_name"].lower(): row["id"] for row in skills},
        [row["code"] for row in codes],
    )


async def profile_is_empty(pool: asyncpg.Pool, candidate_id: UUID) -> bool:
    """Whether anybody has filled this profile in yet.

    The guard that keeps a re-run, or a Candidate who has claimed the account and edited it, from
    being overwritten by a parse.
    """
    filled = await pool.fetchval(
        """
        select exists (select 1 from candidate_experiences where candidate_id = $1)
            or exists (select 1 from candidate_educations  where candidate_id = $1)
            or exists (select 1 from candidate_skills      where candidate_id = $1)
            or exists (select 1 from candidate_languages   where candidate_id = $1)
            or exists (select 1 from candidate_projects    where candidate_id = $1)
        """,
        candidate_id,
    )
    return not filled


@dataclass(frozen=True, slots=True)
class FromManatal:
    """The two structured facts Manatal keeps as fields rather than inside the CV."""

    position: str | None = None
    company: str | None = None
    degree: str | None = None
    university: str | None = None
    graduation_year: int | None = None
    #: The platform's own proficiency for their English, where the account recorded one.
    english: str | None = None

    def experiences(self, candidate_id: UUID) -> list[tuple[Any, ...]]:
        if not (self.position or self.company):
            return []
        return [
            (
                candidate_id,
                0,
                (self.position or "Not stated")[:200],
                (self.company or None) and self.company[:200],
                None,
                None,
                None,
                None,
                True,
                None,
            )
        ]

    def educations(self, candidate_id: UUID) -> list[tuple[Any, ...]]:
        if not (self.degree or self.university or self.graduation_year):
            return []
        return [
            (
                candidate_id,
                0,
                (self.university or "Not stated")[:200],
                (self.degree or None) and self.degree[:200],
                None,
                self.graduation_year,
                None,
            )
        ]

    def languages(self, candidate_id: UUID) -> list[tuple[Any, ...]]:
        if not self.english:
            return []
        return [(candidate_id, 0, "en", self.english)]


#: What the CV parse is measured against when it finds nothing: an empty ATS record.
NOTHING_FROM_MANATAL: Final = FromManatal()


async def publish_profile(
    pool: asyncpg.Pool,
    candidate_id: UUID,
    cv_id: UUID,
    profile: Profile,
    from_manatal: FromManatal = NOTHING_FROM_MANATAL,
    *,
    linkedin_url: str | None = None,
) -> None:
    """Write the parse into the profile and make the Candidate findable, in one transaction.

    Every write in here fires the platform's own `reembed_on_change`, so the embedding worker
    picks the Candidate up and Global search has them once it has run.
    """
    async with pool.acquire() as connection, connection.transaction():
        # The candidate row is what every profile writer queues on in the platform, so this takes
        # it too rather than racing somebody editing through the API.
        await connection.execute("select id from candidates where id = $1 for update", candidate_id)
        await connection.execute(
            """
            update candidates
               set headline = $2,
                   summary = $3,
                   unmapped_skills = $4,
                   linkedin_url = coalesce(linkedin_url, $6),
                   current_cv_id = coalesce(current_cv_id, $5),
                   is_searchable = true
             where id = $1
            """,
            candidate_id,
            profile.headline,
            profile.summary,
            # Union rather than replace: Manatal's own skill list was written at import and the
            # parse only knows what the CV says. Losing the ATS's skills to a thinner CV would
            # be the migration quietly deleting data it had already brought across.
            _merged(await _unmapped_skills(connection, candidate_id), profile.unmapped_skills),
            cv_id,
            linkedin_url,
        )
        # Manatal's own current role and qualification, but only where the CV said nothing of
        # the kind. The parse is richer where it has anything to say; this is what stops an
        # unreadable CV losing the two facts the ATS was sure of.
        experiences = profile.experiences or from_manatal.experiences(candidate_id)
        educations = profile.educations or from_manatal.educations(candidate_id)
        languages = profile.languages or from_manatal.languages(candidate_id)
        await connection.executemany(
            """
            insert into candidate_experiences
                (candidate_id, sort_order, job_title, company_name, start_year, start_month,
                 end_year, end_month, is_current, description)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            experiences,
        )
        await connection.executemany(
            """
            insert into candidate_educations
                (candidate_id, sort_order, institution, degree, field_of_study, graduation_year,
                 description)
            values ($1, $2, $3, $4, $5, $6, $7)
            """,
            educations,
        )
        await connection.executemany(
            """
            insert into candidate_skills (candidate_id, sort_order, taxonomy_id, years_experience)
            values ($1, $2, $3, $4)
            """,
            profile.skills,
        )
        await connection.executemany(
            """
            insert into candidate_languages (candidate_id, sort_order, language_code, proficiency)
            values ($1, $2, $3, $4::language_proficiency)
            """,
            languages,
        )
        await connection.executemany(
            """
            insert into candidate_projects
                (candidate_id, sort_order, name, description, project_url, repository_url,
                 start_year, start_month, end_year, end_month)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            profile.projects,
        )


async def address_is_taken(pool: asyncpg.Pool, email: str) -> bool:
    """Whether an account already exists for this address.

    Asked before making one, so the common case of a re-run does not lean on the identity
    provider's own refusal for something the database can answer.
    """
    return bool(
        await pool.fetchval("select exists (select 1 from auth.users where email = $1)", email)
    )


async def _unmapped_skills(connection: asyncpg.Connection, candidate_id: UUID) -> Sequence[str]:
    written = await connection.fetchval(
        "select unmapped_skills from candidates where id = $1", candidate_id
    )
    return list(written or ())


def _merged(kept: Sequence[str], added: Sequence[str]) -> list[str]:
    """Both lists, in order, without repeating a skill that differs only in case."""
    seen: dict[str, str] = {}
    for skill in (*kept, *added):
        seen.setdefault(skill.strip().lower(), skill.strip())
    return [skill for skill in seen.values() if skill][:MAX_SKILLS]


def linkedin_from_parse(parsed: Mapping[str, Any] | None) -> str | None:
    """A LinkedIn address out of a CV parse, normalised to what the platform stores."""
    if not parsed:
        return None
    stated = parsed.get("linkedin_url")
    return linkedin_address(stated) if isinstance(stated, str) else None


def _path(candidate_id: UUID, cv_id: UUID, media_type: str) -> str:
    return f"{candidate_id}/{cv_id}{EXTENSIONS.get(media_type, '.pdf')}"
