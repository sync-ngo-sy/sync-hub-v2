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
from pathlib import Path

import pytest

from sync_core import get_settings
from sync_parsers import CvFile, Vocabulary
from sync_parsers.openai_extractor import OpenAiCvExtractor
from tests.support.cvs import A_REAL_DOCX_CV, A_REAL_PDF_CV, DOCX, PDF

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
    canonical_skills=[
        "Python",
        "PostgreSQL",
        "Docker",
        "Kubernetes",
        "React",
        "Django",
        "TypeScript",
        "JavaScript",
        "Figma",
        "Git",
    ],
    language_codes=["en", "ar", "fr"],
)

#: Every format the API accepts, and the name each fixture states unambiguously.
FORMATS = [
    pytest.param(A_REAL_PDF_CV, PDF, "Amina", id="pdf"),
    pytest.param(A_REAL_DOCX_CV, DOCX, "Bashir", id="docx"),
]


def a_cv_file(path: Path, media_type: str) -> CvFile:
    return CvFile(filename=path.name, media_type=media_type, content=path.read_bytes())


@pytest.fixture
def extractor() -> OpenAiCvExtractor:
    settings = get_settings()
    assert settings.openai_api_key is not None
    return OpenAiCvExtractor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_cv_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


@pytest.mark.parametrize("path,media_type,name", FORMATS)
async def test_a_real_cv_comes_back_as_structured_data(
    extractor: OpenAiCvExtractor, path: Path, media_type: str, name: str
) -> None:
    """Each accepted format, read by the configured model, through the whole adapter."""
    parsed = await extractor.extract(a_cv_file(path, media_type), VOCABULARY)

    assert parsed.full_name is not None
    assert name in parsed.full_name
    assert parsed.detected_language == "en"
    assert len(parsed.experiences) >= 2
    assert parsed.educations
    assert parsed.languages


@pytest.mark.parametrize("path,media_type,name", FORMATS)
async def test_the_skills_it_returns_come_from_the_list_it_was_given(
    extractor: OpenAiCvExtractor, path: Path, media_type: str, name: str
) -> None:
    """In-model mapping (ADR-0006) — and the invented skills land in `unmapped_skills`.

    Each fixture names two skills ("Quantum Blockchain Alignment", "Telepathic Debugging"
    and friends) precisely because no taxonomy will ever contain them.
    """
    parsed = await extractor.extract(a_cv_file(path, media_type), VOCABULARY)

    named = {skill.name for skill in parsed.skills}
    assert named
    assert named <= set(VOCABULARY.canonical_skills)
    assert parsed.unmapped_skills


async def test_the_uploaded_file_does_not_stay_on_the_providers_storage(
    extractor: OpenAiCvExtractor,
) -> None:
    """A CV is the most personal thing the platform holds; the copy is deleted."""
    before = {file.id async for file in extractor._client.files.list()}

    await extractor.extract(a_cv_file(A_REAL_PDF_CV, PDF), VOCABULARY)

    after = {file.id async for file in extractor._client.files.list()}
    assert after <= before
