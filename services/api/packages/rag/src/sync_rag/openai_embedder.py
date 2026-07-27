from __future__ import annotations

from typing import TYPE_CHECKING

from openai import APIStatusError, AsyncOpenAI, OpenAIError

from sync_core import get_logger
from sync_rag.embedding import EMBEDDING_DIMENSIONS, EmbeddingError

if TYPE_CHECKING:
    from collections.abc import Sequence

logger = get_logger(__name__)


class OpenAiEmbedder:
    def __init__(self, client: AsyncOpenAI, *, model: str) -> None:
        self._client = client
        self._model = model

    @classmethod
    def build(cls, *, api_key: str, model: str, timeout_seconds: float) -> OpenAiEmbedder:
        return cls(
            AsyncOpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=2), model=model
        )

    @property
    def model(self) -> str:
        return self._model

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = await self._client.embeddings.create(
                model=self._model, input=list(texts), dimensions=EMBEDDING_DIMENSIONS
            )
        except OpenAIError as unavailable:
            status = unavailable.status_code if isinstance(unavailable, APIStatusError) else None
            logger.warning(
                "embedding.provider_failed", error=type(unavailable).__name__, status=status
            )
            raise EmbeddingError(f"OpenAI could not embed {len(texts)} texts") from unavailable

        return [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
