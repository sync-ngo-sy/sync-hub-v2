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

VOCABULARY = Vocabulary(
    canonical_roles=["backend-engineer", "frontend-engineer", "data-scientist"],
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
    parsed = await extractor.extract(a_cv_file(path, media_type), VOCABULARY)

    named = {skill.name for skill in parsed.skills}
    assert named
    assert named <= set(VOCABULARY.canonical_skills)
    assert parsed.unmapped_skills


async def test_the_uploaded_file_does_not_stay_on_the_providers_storage(
    extractor: OpenAiCvExtractor,
) -> None:
    before = {file.id async for file in extractor._client.files.list()}

    await extractor.extract(a_cv_file(A_REAL_PDF_CV, PDF), VOCABULARY)

    after = {file.id async for file in extractor._client.files.list()}
    assert after <= before
