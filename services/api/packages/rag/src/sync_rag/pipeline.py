from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import delete

from sync_core import get_logger
from sync_core.models import CandidateProfileChunk
from sync_rag.chunks import chunks_of
from sync_rag.embedding import EMBEDDING_DIMENSIONS, EmbeddingError
from sync_rag.profile import current_profile

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database
    from sync_rag.chunks import ChunkType
    from sync_rag.embedding import Embedder

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class EmbeddedChunk:
    chunk_type: ChunkType
    text: str
    embedding: Sequence[float]


class ProfileEmbedding:
    def __init__(self, database: Database, embedder: Embedder) -> None:
        self._database = database
        self._embedder = embedder

    async def rebuild(self, candidate_id: UUID) -> list[EmbeddedChunk]:
        async with self._database.session() as session:
            profile = await current_profile(session, candidate_id)
        if profile is None:
            logger.warning("embedding.candidate_gone", candidate_id=str(candidate_id))
            return []

        chunks = chunks_of(profile)
        if not chunks:
            return []

        vectors = await self._embedder.embed([chunk.text for chunk in chunks])
        return [
            EmbeddedChunk(chunk_type=chunk.chunk_type, text=chunk.text, embedding=_checked(vector))
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]

    async def swap(
        self, session: AsyncSession, candidate_id: UUID, chunks: Sequence[EmbeddedChunk]
    ) -> None:
        await session.execute(
            delete(CandidateProfileChunk).where(CandidateProfileChunk.candidate_id == candidate_id)
        )
        session.add_all(
            [
                CandidateProfileChunk(
                    candidate_id=candidate_id,
                    chunk_type=chunk.chunk_type.value,
                    chunk_text=chunk.text,
                    chunk_index=index,
                    embedding=list(chunk.embedding),
                    embedding_model=self._embedder.model,
                )
                for index, chunk in enumerate(chunks)
            ]
        )


def _checked(vector: Sequence[float]) -> Sequence[float]:
    if len(vector) != EMBEDDING_DIMENSIONS:
        raise EmbeddingError(
            f"the embedder answered with {len(vector)} dimensions, not {EMBEDDING_DIMENSIONS}"
        )
    return vector
