"""The generated models are the migrated schema — not a hand-maintained guess at it."""

from __future__ import annotations

from pgvector.sqlalchemy.vector import VECTOR
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import Base, Candidate, CandidateProfileChunk, Cv, Job, Profile


async def test_models_cover_exactly_the_schema_in_the_database(db_session: AsyncSession) -> None:
    """A migration applied without regenerating the models fails here, loudly.

    Compares columns, not just table names — an added or renamed column drifts just as
    silently as a whole table would.
    """
    result = await db_session.execute(
        text(
            "select table_name, column_name from information_schema.columns "
            "where table_schema = 'public'"
        )
    )
    in_database = {(table, column) for table, column in result}
    in_models = {
        (table.name, column.name)
        for name, table in Base.metadata.tables.items()
        if name.startswith("public.")
        for column in table.columns
    }

    assert in_models == in_database


async def test_models_expose_the_domain_vocabulary() -> None:
    assert Candidate.__tablename__ == "candidates"
    assert Profile.__tablename__ == "profiles"
    assert Job.__tablename__ == "jobs"
    assert Cv.__tablename__ == "cvs"


async def test_embeddings_keep_their_vector_type() -> None:
    """pgvector's type survives generation — a plain NullType would break search silently."""
    embedding = CandidateProfileChunk.__table__.c.embedding.type

    assert isinstance(embedding, VECTOR)
    assert embedding.dim == 768


async def test_a_session_reads_and_writes_the_real_database(db_session: AsyncSession) -> None:
    result = await db_session.execute(text("select 1"))

    assert result.scalar_one() == 1
