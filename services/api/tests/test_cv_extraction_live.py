"""The OpenAI adapter against the real thing.

Marked `ai_live` and excluded from the default run: it needs a key, costs money, and is
non-deterministic in a way no assertion should pretend otherwise. What it is here for is
the half the fake extractor can never cover — that `ParsedCv` is a schema the API will
actually accept, that a PDF sent as `input_file` comes back as structured data, and that
the uploaded file is deleted afterwards (ADR-0006).

    uv run pytest -m ai_live

The assertions are deliberately loose. They check the shape of the answer and the handful
of facts the fixture CV states unambiguously — not how the model chose to phrase a summary.
"""

from __future__ import annotations

import os

import pytest

from sync_core import get_settings
from sync_parsers import CvDocument, Vocabulary
from sync_parsers.openai_extractor import OpenAiCvExtractor
from tests.support.cvs import A_REAL_CV, PDF

pytestmark = [
    pytest.mark.ai_live,
    pytest.mark.skipif(
        not os.environ.get("SYNC_OPENAI_API_KEY"),
        reason="SYNC_OPENAI_API_KEY is not set",
    ),
]

#: The same vocabulary the pipeline builds from the seeded reference data. Spelled out
#: rather than read from the database, so this test needs no stack at all.
VOCABULARY = Vocabulary(
    canonical_skills=["Python", "PostgreSQL", "Docker", "Kubernetes", "React", "Django"],
    language_codes=["en", "ar", "fr"],
)


@pytest.fixture
def extractor() -> OpenAiCvExtractor:
    settings = get_settings()
    assert settings.openai_api_key is not None
    return OpenAiCvExtractor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_cv_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


async def test_a_real_cv_comes_back_as_structured_data(extractor: OpenAiCvExtractor) -> None:
    """The fixture CV, read by the configured model, through the whole adapter."""
    document = CvDocument(filename=A_REAL_CV.name, media_type=PDF, content=A_REAL_CV.read_bytes())

    parsed = await extractor.extract(document, VOCABULARY)

    assert parsed.full_name is not None
    assert "Amina" in parsed.full_name
    assert parsed.detected_language == "en"
    assert len(parsed.experiences) >= 2
    assert any("Acme" in (job.company_name or "") for job in parsed.experiences)
    assert parsed.educations
    assert parsed.languages


async def test_the_skills_it_returns_come_from_the_list_it_was_given(
    extractor: OpenAiCvExtractor,
) -> None:
    """In-model mapping (ADR-0006) — and the two invented skills land in `unmapped_skills`.

    The fixture names "Quantum Blockchain Alignment" and "Vibe-Driven Development"
    precisely because no taxonomy will ever contain them.
    """
    document = CvDocument(filename=A_REAL_CV.name, media_type=PDF, content=A_REAL_CV.read_bytes())

    parsed = await extractor.extract(document, VOCABULARY)

    named = {skill.name for skill in parsed.skills}
    assert named
    assert named <= set(VOCABULARY.canonical_skills)
    assert "Python" in named
    assert parsed.unmapped_skills


async def test_the_uploaded_file_does_not_stay_on_the_providers_storage(
    extractor: OpenAiCvExtractor,
) -> None:
    """A CV is the most personal document the platform holds; the copy is deleted."""
    document = CvDocument(filename=A_REAL_CV.name, media_type=PDF, content=A_REAL_CV.read_bytes())
    before = {file.id async for file in extractor._client.files.list()}

    await extractor.extract(document, VOCABULARY)

    after = {file.id async for file in extractor._client.files.list()}
    assert after <= before
