from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sync_assessments import AssessedMatch
from sync_core.models import SkillImportance

if TYPE_CHECKING:
    from sync_assessments import MatchRequest

MODEL: Final = "fake-assessor"


class FakeAssessor:
    """Deterministic advice: the share of the Job's required skills the Application evidences,
    named in an explanation that quotes both. Tests assert a number they can predict, and no
    test in the main suite ever reaches a provider."""

    model = MODEL

    def __init__(self, failure: Exception | None = None) -> None:
        self.requests: list[MatchRequest] = []
        self.failure = failure

    @property
    def call_count(self) -> int:
        return len(self.requests)

    def last(self) -> MatchRequest:
        assert self.requests, "the assessor was never asked"
        return self.requests[-1]

    async def assess(self, request: MatchRequest) -> AssessedMatch:
        self.requests.append(request)
        if self.failure is not None:
            raise self.failure
        return _assessed(request)


def _assessed(request: MatchRequest) -> AssessedMatch:
    required = [
        skill.name for skill in request.job.skills if skill.importance is SkillImportance.REQUIRED
    ]
    held = {skill.name for skill in request.application.skills}
    matched = [name for name in required if name in held]
    missing = [name for name in required if name not in held]
    return AssessedMatch(
        match_percentage=100.0 if not required else 100.0 * len(matched) / len(required),
        explanation=f"{request.application.headline or 'The application'} against "
        f"{request.job.title}.",
        strengths=[f"{name} is evidenced" for name in matched],
        gaps=[f"{name} is not listed" for name in missing],
    )
