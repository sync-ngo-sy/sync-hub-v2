"""The port CV extraction happens behind (ADR-0006).

Two implementations exist: the OpenAI adapter in `sync_parsers.openai_extractor`, and the
deterministic fake the test suite parses with. The pipeline knows only this protocol, which
is what makes the main suite runnable without an API key and a future switch to a different
model platform one new file.

Failures are split into two kinds, because the worker treats them differently. Something
temporarily wrong with the provider is worth another attempt; a document the model cannot
read is not, and retrying it twice more only spends money to reach the same answer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_parsers.schema import ParsedCv


@dataclass(frozen=True, slots=True)
class CvDocument:
    """One CV file, as it was uploaded.

    The bytes themselves, because ADR-0006 sends the document to the model rather than text
    extracted from it — there is no local extraction step for this to be the input of.
    """

    filename: str
    media_type: str
    content: bytes


@dataclass(frozen=True, slots=True)
class Vocabulary:
    """The platform's own words, which a parse has to speak.

    Embedded in the prompt so the mapping happens in-model (ADR-0006). The backend checks
    the answer against these same lists afterwards — this is what the model is *asked* for,
    not what it is trusted to have done.
    """

    canonical_skills: Sequence[str]
    language_codes: Sequence[str]


class ExtractionError(Exception):
    """A CV could not be turned into a `ParsedCv`."""


class UnreadableCvError(ExtractionError):
    """The model would not, or could not, read this document.

    Permanent: the same file through the same model gets the same answer, so the worker
    stops here rather than spending its remaining attempts confirming it.
    """


class ExtractorUnavailableError(ExtractionError):
    """The provider was unreachable, overloaded, or answered something unusable.

    Transient: worth another attempt after a backoff.
    """


class CvExtractor(Protocol):
    """Turn a CV document into structured data, or raise `ExtractionError`."""

    async def extract(self, document: CvDocument, vocabulary: Vocabulary) -> ParsedCv: ...
