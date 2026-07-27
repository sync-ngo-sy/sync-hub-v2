from __future__ import annotations

import re
from hashlib import blake2b
from math import sqrt
from typing import TYPE_CHECKING, Final

from sync_rag import EMBEDDING_DIMENSIONS

if TYPE_CHECKING:
    from collections.abc import Sequence

WORD: Final = re.compile(r"[a-z0-9]+")


class FakeEmbedder:
    """Deterministic bag of words: texts sharing words come out close, so the ranking a test
    asserts is the real one and no test ever calls a provider."""

    model = "fake-bag-of-words"

    def __init__(self, failure: Exception | None = None) -> None:
        self.calls: list[list[str]] = []
        self.failure = failure

    @property
    def call_count(self) -> int:
        return len(self.calls)

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        if self.failure is not None:
            raise self.failure
        return [_vector(text) for text in texts]


def _vector(text: str) -> list[float]:
    counted = [0.0] * EMBEDDING_DIMENSIONS
    for word in WORD.findall(text.lower()):
        counted[_dimension_of(word)] += 1.0
    length = sqrt(sum(value * value for value in counted))
    if not length:
        counted[0] = 1.0
        return counted
    return [value / length for value in counted]


def _dimension_of(word: str) -> int:
    return int.from_bytes(blake2b(word.encode(), digest_size=8).digest()) % EMBEDDING_DIMENSIONS
