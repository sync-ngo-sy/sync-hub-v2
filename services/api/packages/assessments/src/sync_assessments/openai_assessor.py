from __future__ import annotations

from typing import TYPE_CHECKING

from openai import APIStatusError, AsyncOpenAI, OpenAIError

from sync_assessments.assessor import AssessmentError
from sync_assessments.prompt import INSTRUCTIONS, as_document
from sync_assessments.schema import AssessedMatch
from sync_core import get_logger

if TYPE_CHECKING:
    from openai.types.responses import ParsedResponse

    from sync_assessments.assessor import MatchRequest

logger = get_logger(__name__)


class OpenAiMatchAssessor:
    def __init__(self, client: AsyncOpenAI, *, model: str) -> None:
        self._client = client
        self._model = model

    @classmethod
    def build(cls, *, api_key: str, model: str, timeout_seconds: float) -> OpenAiMatchAssessor:
        return cls(
            AsyncOpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=2), model=model
        )

    @property
    def model(self) -> str:
        return self._model

    async def assess(self, request: MatchRequest) -> AssessedMatch:
        try:
            response = await self._client.responses.parse(
                model=self._model,
                instructions=INSTRUCTIONS,
                input=as_document(request),
                text_format=AssessedMatch,
            )
        except OpenAIError as failed:
            status = failed.status_code if isinstance(failed, APIStatusError) else None
            logger.warning(
                "match_assessment.provider_failed", error=type(failed).__name__, status=status
            )
            raise AssessmentError("OpenAI could not complete the assessment") from failed
        return _assessed_from(response)


def _assessed_from(response: ParsedResponse[AssessedMatch]) -> AssessedMatch:
    """Nothing partial is worth recording: an assessment a recruiter cannot read is a failure
    they should be able to retry, not a row saying the model gave up."""
    if response.status == "incomplete":
        reason = getattr(response.incomplete_details, "reason", "unknown")
        raise AssessmentError(f"the model stopped before finishing the assessment ({reason})")

    for item in response.output:
        if item.type == "message":
            for part in item.content:
                if part.type == "refusal":
                    raise AssessmentError(f"the model refused the assessment: {part.refusal}")

    assessed = response.output_parsed
    if not isinstance(assessed, AssessedMatch):
        raise AssessmentError("the model answered with nothing we could read as an assessment")
    return assessed
