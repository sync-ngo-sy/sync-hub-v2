from __future__ import annotations

import os
from math import sqrt
from typing import TYPE_CHECKING

import pytest

from sync_core import get_settings
from sync_rag import EMBEDDING_DIMENSIONS
from sync_rag.openai_embedder import OpenAiEmbedder

if TYPE_CHECKING:
    from collections.abc import Sequence

pytestmark = [
    pytest.mark.ai_live,
    pytest.mark.skipif(
        not os.environ.get("SYNC_OPENAI_API_KEY"),
        reason="SYNC_OPENAI_API_KEY is not set",
    ),
]

A_QUERY = "backend engineer who has run payment systems"
A_MATCHING_PROFILE = "Senior Backend Engineer at Acme Payments. Led the payments ledger rewrite."
AN_UNRELATED_PROFILE = "Pastry chef. Croissants, and the ovens that ruin them."


@pytest.fixture
def embedder() -> OpenAiEmbedder:
    settings = get_settings()
    assert settings.openai_api_key is not None
    return OpenAiEmbedder.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_embedding_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


async def test_a_real_embedding_is_as_wide_as_the_column(embedder: OpenAiEmbedder) -> None:
    [vector] = await embedder.embed([A_QUERY])

    assert len(vector) == EMBEDDING_DIMENSIONS


async def test_the_real_model_puts_the_matching_profile_closer(embedder: OpenAiEmbedder) -> None:
    query, matching, unrelated = await embedder.embed(
        [A_QUERY, A_MATCHING_PROFILE, AN_UNRELATED_PROFILE]
    )

    assert _similarity(query, matching) > _similarity(query, unrelated)


def _similarity(one: Sequence[float], other: Sequence[float]) -> float:
    length = sqrt(sum(value**2 for value in one)) * sqrt(sum(value**2 for value in other))
    return sum(left * right for left, right in zip(one, other, strict=True)) / length
