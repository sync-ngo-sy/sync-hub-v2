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

if TYPE_CHECKING:
    from profile_rows import Profile

#: What `cv_object_path` produces in the platform: the candidate's own folder, the CV's id, and
#: the extension the media type implies.
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


async def create_candidate(
    pool: asyncpg.Pool, account_id: UUID, *, full_name: str, headline: str | None
) -> None:
    """The two rows a Candidate is, in one transaction, as signup writes them.

    Flagged as Manatal's: nothing else in the schema would say so, and a Recruiter
    reading one of these needs to know that nobody typed it.
    """
    async with pool.acquire() as connection, connection.transaction():
        await connection.execute(
            "insert into profiles (id, account_type, full_name) values ($1, 'candidate', $2)",
            account_id,
            full_name,
        )
        await connection.execute(
            """
            insert into candidates (id, headline, is_imported_from_manatal)
            values ($1, $2, true)
            """,
            account_id,
            headline,
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


async def publish_profile(
    pool: asyncpg.Pool, candidate_id: UUID, cv_id: UUID, profile: Profile
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
                   current_cv_id = coalesce(current_cv_id, $5),
                   is_searchable = true
             where id = $1
            """,
            candidate_id,
            profile.headline,
            profile.summary,
            profile.unmapped_skills,
            cv_id,
        )
        await connection.executemany(
            """
            insert into candidate_experiences
                (candidate_id, sort_order, job_title, company_name, start_year, start_month,
                 end_year, end_month, is_current, description)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            profile.experiences,
        )
        await connection.executemany(
            """
            insert into candidate_educations
                (candidate_id, sort_order, institution, degree, field_of_study, graduation_year,
                 description)
            values ($1, $2, $3, $4, $5, $6, $7)
            """,
            profile.educations,
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
            profile.languages,
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


def _path(candidate_id: UUID, cv_id: UUID, media_type: str) -> str:
    return f"{candidate_id}/{cv_id}{EXTENSIONS.get(media_type, '.pdf')}"
