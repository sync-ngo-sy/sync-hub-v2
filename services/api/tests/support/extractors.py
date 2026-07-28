from __future__ import annotations

from typing import TYPE_CHECKING

from sync_core.models import LanguageProficiency
from sync_parsers import (
    ParsedCv,
    ParsedEducation,
    ParsedExperience,
    ParsedLanguage,
    ParsedProject,
    ParsedSkill,
)

if TYPE_CHECKING:
    from sync_parsers import CvFile, Vocabulary


def a_parse(**changes: object) -> ParsedCv:
    return AMINA.model_copy(update=changes)


AMINA = ParsedCv(
    full_name="Amina Haddad",
    email="amina.haddad@example.com",
    phone="+963 11 555 0134",
    detected_language="en",
    headline="Backend engineer, 8 years",
    summary="Builds boring payment systems that stay up.",
    location="Damascus, Syria",
    experiences=[
        ParsedExperience(
            job_title="Senior Backend Engineer",
            company_name="Acme Payments",
            start_year=2021,
            start_month=3,
            end_year=None,
            end_month=None,
            is_current=True,
            description="Led the payments ledger rewrite.",
        ),
        ParsedExperience(
            job_title="Backend Engineer",
            company_name="Globex",
            start_year=2018,
            start_month=1,
            end_year=2021,
            end_month=2,
            is_current=False,
            description=None,
        ),
    ],
    educations=[
        ParsedEducation(
            institution="Damascus University",
            degree="BSc",
            field_of_study="Computer Science",
            graduation_year=2017,
            description=None,
        )
    ],
    skills=[
        ParsedSkill(name="Python", years_experience=8.0),
        ParsedSkill(name="PostgreSQL", years_experience=7.0),
    ],
    languages=[
        ParsedLanguage(code="ar", proficiency=LanguageProficiency.NATIVE),
        ParsedLanguage(code="en", proficiency=LanguageProficiency.FLUENT),
    ],
    projects=[
        ParsedProject(
            name="Sync",
            description="A recruitment platform.",
            project_url="https://example.com/sync",
            repository_url=None,
            start_year=2024,
            start_month=6,
            end_year=None,
            end_month=None,
        )
    ],
    unmapped_skills=["Vibe-Driven Development"],
)


class FakeExtractor:
    def __init__(self, *answers: ParsedCv | Exception) -> None:
        self._answers = list(answers) or [AMINA]
        self.calls: list[tuple[CvFile, Vocabulary]] = []

    @property
    def call_count(self) -> int:
        return len(self.calls)

    async def extract(self, file: CvFile, vocabulary: Vocabulary) -> ParsedCv:
        self.calls.append((file, vocabulary))
        answer = self._answers[min(len(self.calls) - 1, len(self._answers) - 1)]
        if isinstance(answer, Exception):
            raise answer
        return answer
