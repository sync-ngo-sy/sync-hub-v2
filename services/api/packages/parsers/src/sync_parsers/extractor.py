from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_parsers.schema import ParsedCv


@dataclass(frozen=True, slots=True)
class CvFile:
    filename: str
    media_type: str
    content: bytes


@dataclass(frozen=True, slots=True)
class Vocabulary:
    canonical_skills: Sequence[str]
    canonical_roles: Sequence[str]
    language_codes: Sequence[str]


class ExtractionError(Exception):
    pass


class UnreadableCvError(ExtractionError):
    pass


class ExtractorUnavailableError(ExtractionError):
    pass


class CvExtractor(Protocol):
    async def extract(self, file: CvFile, vocabulary: Vocabulary) -> ParsedCv: ...
