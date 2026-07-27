from __future__ import annotations

from typing import TYPE_CHECKING, Final, Protocol

if TYPE_CHECKING:
    from collections.abc import Sequence

#: What `candidate_profile_chunks.embedding` is declared as: `vector(768)`.
EMBEDDING_DIMENSIONS: Final = 768


class EmbeddingError(Exception):
    pass


class Embedder(Protocol):
    @property
    def model(self) -> str: ...

    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]: ...
