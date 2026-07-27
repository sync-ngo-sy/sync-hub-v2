"""The `CvExtractor` that actually reads CVs (ADR-0006).

The CV file is uploaded to the Files API and referenced by id, and the Responses API is
asked for a `ParsedCv` through structured outputs — so the answer is schema-valid before it
reaches us, and there is no JSON to hand-parse or hand-repair.

The upload is deleted in a `finally`. Nothing else deletes it: a CV is the most personal
document the platform holds, and leaving copies on a provider's storage because a parse
raised is not a leak anybody would notice until it mattered.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, Literal

from openai import APIStatusError, AsyncOpenAI, OpenAIError

from sync_core import get_logger
from sync_parsers.extractor import ExtractorUnavailableError, UnreadableCvError
from sync_parsers.prompt import parse_instructions
from sync_parsers.schema import ParsedCv

if TYPE_CHECKING:
    from openai.types.responses import ParsedResponse

    from sync_parsers.extractor import CvFile, Vocabulary

logger = get_logger(__name__)

#: What the Files API is told the upload is for. `user_data` is the purpose for a file the
#: model is meant to read as input, and it is what `input_file` accepts.
FILE_PURPOSE: Final[Literal["user_data"]] = "user_data"

#: Statuses that mean "this file, through this model, will not parse". Anything else —
#: a timeout, a 429, a 5xx — is the provider having a moment and is worth another attempt.
PERMANENT_STATUSES: Final = frozenset({400, 413, 415, 422})


class OpenAiCvExtractor:
    """Reads a CV by sending the file itself to OpenAI."""

    def __init__(self, client: AsyncOpenAI, *, model: str) -> None:
        self._client = client
        self._model = model

    @classmethod
    def build(cls, *, api_key: str, model: str, timeout_seconds: float) -> OpenAiCvExtractor:
        """The adapter a worker process runs with.

        `max_retries` is the SDK's own — connection errors and 429s are retried inside one
        attempt, which is the fast retry. The queue's `attempts`/`available_at` backoff is
        the slow one, for everything that outlives a single call.
        """
        return cls(
            AsyncOpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=2), model=model
        )

    async def extract(self, file: CvFile, vocabulary: Vocabulary) -> ParsedCv:
        file_id = await self._upload(file)
        try:
            response = await self._parse(file_id, vocabulary)
        finally:
            await self._delete(file_id)
        return _parsed_from(response)

    async def _upload(self, file: CvFile) -> str:
        with _provider_failures("upload"):
            uploaded = await self._client.files.create(
                file=(file.filename, file.content, file.media_type),
                purpose=FILE_PURPOSE,
            )
        return uploaded.id

    async def _parse(self, file_id: str, vocabulary: Vocabulary) -> ParsedResponse[ParsedCv]:
        with _provider_failures("parse"):
            return await self._client.responses.parse(
                model=self._model,
                instructions=parse_instructions(vocabulary),
                input=[
                    {
                        "role": "user",
                        "content": [{"type": "input_file", "file_id": file_id}],
                    }
                ],
                text_format=ParsedCv,
            )

    async def _delete(self, file_id: str) -> None:
        """Best effort, and loud when it fails.

        Deliberately swallowing: this runs in a `finally`, and a delete that raised would
        replace the real outcome — a good parse, or the error explaining a bad one — with a
        housekeeping failure. The log line is what turns an accumulating provider-side copy
        into something someone can find.
        """
        try:
            await self._client.files.delete(file_id)
        except OpenAIError as error:
            logger.error("cv_extraction.file_not_deleted", file_id=file_id, error=str(error))


def _parsed_from(response: ParsedResponse[ParsedCv]) -> ParsedCv:
    """The `ParsedCv` out of a response, or the reason there is not one."""
    if response.status == "incomplete":
        reason = getattr(response.incomplete_details, "reason", "unknown")
        raise UnreadableCvError(f"the model stopped before finishing the parse ({reason})")

    for item in response.output:
        if item.type == "message":
            for part in item.content:
                if part.type == "refusal":
                    raise UnreadableCvError(part.refusal)

    parsed = response.output_parsed
    if not isinstance(parsed, ParsedCv):
        raise ExtractorUnavailableError("the model answered with nothing we could read as a parse")
    return parsed


class _provider_failures:  # noqa: N801 — reads as a statement at the call site, not as a type
    """Translate whatever OpenAI raises into transient or permanent, and nothing else.

    The same shape as `sync_api.auth.gotrue.refusals`, for the same reason: the layer above
    decides whether to retry, and it should decide on the meaning of a failure rather than
    on an HTTP status it had to learn to read.
    """

    def __init__(self, step: str) -> None:
        self._step = step

    def __enter__(self) -> None:
        return None

    def __exit__(
        self, kind: object, exc: BaseException | None, traceback: object
    ) -> Literal[False]:
        if not isinstance(exc, OpenAIError):
            return False
        status = exc.status_code if isinstance(exc, APIStatusError) else None
        logger.warning(
            "cv_extraction.provider_failed",
            step=self._step,
            error=type(exc).__name__,
            status=status,
        )
        if status in PERMANENT_STATUSES:
            raise UnreadableCvError(f"OpenAI rejected the {self._step} with {status}") from exc
        raise ExtractorUnavailableError(f"OpenAI could not complete the {self._step}") from exc
