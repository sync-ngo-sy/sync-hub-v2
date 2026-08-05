from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sync_api.problems import CANDIDATE_ONLY_PROBLEM_TYPE, Problem
from sync_core import get_logger
from sync_core.models import AccountType

if TYPE_CHECKING:
    from uuid import UUID

    from sync_api.auth import ActingProfile

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ActingCandidate:
    profile: ActingProfile

    @property
    def id(self) -> UUID:
        return self.profile.id


def acting_candidate(profile: ActingProfile) -> ActingCandidate:
    """No query of its own: the Profile was read with its `candidates` row alongside it."""
    if profile.account_type is not AccountType.CANDIDATE:
        raise _candidate_only()

    if not profile.has_account_row:
        logger.error("candidates.candidate_row_missing", profile_id=str(profile.id))
        raise _candidate_only()

    return ActingCandidate(profile=profile)


def _candidate_only() -> Problem:
    return Problem(
        status=403,
        type=CANDIDATE_ONLY_PROBLEM_TYPE,
        detail="This is only available to candidate accounts.",
    )
