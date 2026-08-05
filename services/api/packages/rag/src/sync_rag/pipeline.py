from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from sync_core import get_logger
from sync_core.models import CandidateProfileChunk, EmbeddingModel
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
        """Every chunk of the current profile, embedding only the text that is new.

        A profile is rebuilt whole on every change, but most of it is usually the same words as
        before — adding one skill leaves the identity, the jobs and the education untouched. The
        text a chunk is made of is what its vector means, so identical text can keep the vector it
        already had, and only what actually changed reaches the model.
        """
        async with self._database.session() as session:
            profile = await current_profile(session, candidate_id)
            if profile is None:
                logger.warning("embedding.candidate_gone", candidate_id=str(candidate_id))
                return []
            chunks = chunks_of(profile)
            if not chunks:
                return []
            already = await self._already_embedded(session, candidate_id)

        fresh = [chunk.text for chunk in chunks if chunk.text not in already]
        written = dict(zip(fresh, await self._embedder.embed(fresh), strict=True)) if fresh else {}
        logger.info(
            "embedding.profile_rebuilt",
            candidate_id=str(candidate_id),
            embedded=len(fresh),
            reused=len(chunks) - len(fresh),
        )
        return [
            EmbeddedChunk(
                chunk_type=chunk.chunk_type,
                text=chunk.text,
                embedding=_checked(written[chunk.text])
                if chunk.text in written
                else already[chunk.text],
            )
            for chunk in chunks
        ]

    async def swap(
        self, session: AsyncSession, candidate_id: UUID, chunks: Sequence[EmbeddedChunk]
    ) -> None:
        await self._establish_the_model(session)
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

    async def _already_embedded(
        self, session: AsyncSession, candidate_id: UUID
    ) -> dict[str, list[float]]:
        stored = await session.execute(
            select(CandidateProfileChunk.chunk_text, CandidateProfileChunk.embedding).where(
                CandidateProfileChunk.candidate_id == candidate_id,
                CandidateProfileChunk.embedding_model == self._embedder.model,
            )
        )
        return {text: [float(value) for value in vector] for text, vector in stored.tuples()}

    async def _establish_the_model(self, session: AsyncSession) -> None:
        """One model for the whole corpus, so every distance the index ranks means the same thing.

        The first deployment to write a chunk decides it. Changing it means deleting every chunk
        and the row, which is the re-embed that has to happen anyway — so the alternative to this
        refusal is a ranking computed across two models that reports no error at all.
        """
        established = await session.scalar(select(EmbeddingModel.model))
        if established is not None and established != self._embedder.model:
            raise EmbeddingError(
                f"the corpus was embedded with {established!r} and this worker is running "
                f"{self._embedder.model!r}: delete every chunk before changing model"
            )
        await session.execute(
            insert(EmbeddingModel)
            .values(model=self._embedder.model)
            .on_conflict_do_nothing(index_elements=["model"])
        )


def _checked(vector: Sequence[float]) -> Sequence[float]:
    if len(vector) != EMBEDDING_DIMENSIONS:
        raise EmbeddingError(
            f"the embedder answered with {len(vector)} dimensions, not {EMBEDDING_DIMENSIONS}"
        )
    return vector
