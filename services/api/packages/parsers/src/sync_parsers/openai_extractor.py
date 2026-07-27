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

FILE_PURPOSE: Final[Literal["user_data"]] = "user_data"

PERMANENT_STATUSES: Final = frozenset({400, 413, 415, 422})


class OpenAiCvExtractor:
    def __init__(self, client: AsyncOpenAI, *, model: str) -> None:
        self._client = client
        self._model = model

    @classmethod
    def build(cls, *, api_key: str, model: str, timeout_seconds: float) -> OpenAiCvExtractor:
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
        try:
            await self._client.files.delete(file_id)
        except OpenAIError as error:
            logger.error("cv_extraction.file_not_deleted", file_id=file_id, error=str(error))


def _parsed_from(response: ParsedResponse[ParsedCv]) -> ParsedCv:
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
