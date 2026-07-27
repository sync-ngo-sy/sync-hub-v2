"""Who a candidate-scoped request is acting as.

The counterpart of `sync_api.tenants.access`, and much shorter, because a Candidate has no
Tenant to be inside and no kill-switch above them: either the caller is a Candidate or they
have come to the recruiter half of the platform by mistake.

ADR-0002 put every ownership check in the API, and this is where the candidate ones start.
A route that asks for an `ActingCandidate` never has to name a candidate id — it is the
caller's own, always, which is why the routes say `/me` and take no id at all.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sync_api.problems import CANDIDATE_ONLY_PROBLEM_TYPE, Problem
from sync_core import get_logger
from sync_core.models import AccountType, Candidate

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth import ActingProfile

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ActingCandidate:
    """A Candidate acting on their own data.

    Holding one is the proof: it cannot be constructed for a Recruiter, so a route that
    asks for one has already made the only check the candidate half of the platform has.
    """

    profile: ActingProfile

    @property
    def id(self) -> UUID:
        """The Candidate, the Profile and the Supabase Auth user share it (supabase ADR-0001)."""
        return self.profile.id


async def acting_candidate(session: AsyncSession, profile: ActingProfile) -> ActingCandidate:
    """Establish that the caller is a Candidate who exists, or refuse with 403."""
    if profile.account_type is not AccountType.CANDIDATE:
        raise _candidate_only()

    # A cache hit for every route that goes on to read or write the profile: the row is
    # already in this session's identity map by the time the service asks for it.
    if await session.get(Candidate, profile.id) is None:
        # A candidate Profile with no Candidate row is a provisioning bug, not a caller
        # error — but it is still a caller who has no profile to act on, so refuse, and say
        # so in the log where someone can act on it.
        logger.error("candidates.candidate_row_missing", profile_id=str(profile.id))
        raise _candidate_only()

    return ActingCandidate(profile=profile)


def _candidate_only() -> Problem:
    """One sentence for both ways of not being a usable Candidate.

    A caller must not be able to tell "you are a Recruiter" from "your Candidate row is
    missing" — the second is our bug, and describing it says something about the platform's
    internals in exchange for nothing they can act on.
    """
    return Problem(
        status=403,
        type=CANDIDATE_ONLY_PROBLEM_TYPE,
        detail="This is only available to candidate accounts.",
    )
