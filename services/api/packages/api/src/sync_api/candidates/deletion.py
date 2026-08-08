from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from sqlalchemy import delete, update

from sync_api.auth.gotrue import GoTrueUnavailableError, InvalidCredentialsError
from sync_api.candidates.profile import whole_candidate
from sync_api.problems import INVALID_CREDENTIALS_PROBLEM_TYPE, Problem
from sync_core import get_logger, transaction
from sync_core.models import (
    CandidateEducation,
    CandidateEmbeddingJob,
    CandidateExperience,
    CandidateLanguage,
    CandidateProfileChunk,
    CandidateProject,
    CandidateSkill,
    Cv,
    Notification,
    TalentPoolMember,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue

logger = get_logger(__name__)

#: `profiles.full_name` is NOT NULL, so the scrub leaves a placeholder rather than a name. The
#: Snapshot a Tenant reviews keeps the real one — it was captured when the Application was made.
DELETED_NAME: Final = "Deleted account"


class CandidateDeletion:
    """A Candidate erasing themselves: the login stops working, the live profile is scrubbed and
    every discovery artifact is purged, while the Applications Tenants received stay whole.

    Nothing is hard-deleted. `applications.candidate_id` has no `ON DELETE` clause and
    `applications (candidate_id, cv_id)` points at `cvs`, so Postgres refuses to drop either row
    while an Application names it — a soft delete is the only shape this can take.
    """

    def __init__(self, session: AsyncSession, gotrue: GoTrue) -> None:
        self._db = session
        self._gotrue = gotrue

    async def delete(self, candidate_id: UUID, *, email: str, password: str) -> None:
        await self._confirm(email=email, password=password)
        await self._scrub(candidate_id)
        await self._ban_the_login(candidate_id)
        logger.info("candidates.account_deleted", candidate_id=str(candidate_id))

    async def _confirm(self, *, email: str, password: str) -> None:
        try:
            await self._gotrue.verify_password(email=email, password=password)
        except InvalidCredentialsError as exc:
            raise Problem(
                status=401,
                type=INVALID_CREDENTIALS_PROBLEM_TYPE,
                detail="That is not your password. Deleting an account needs it.",
            ) from exc

    async def _scrub(self, candidate_id: UUID) -> None:
        """One transaction, in an order the constraints and triggers dictate.

        The scrub lands first and whole: `candidates_searchable_needs_cv` refuses a Searchable
        candidate with no current CV, so dropping `current_cv_id` and opting out of Global search
        have to reach Postgres in the same flush.

        Then the CVs, because `forbid_deleting_current_cv` fires for the service role too and
        needs `current_cv_id` already NULL. The embedding job goes last: every write above it
        fires `reembed_on_change`, which would re-enqueue a row deleted any earlier.
        """
        now = datetime.now(UTC)
        async with transaction(self._db):
            candidate, identity = await whole_candidate(self._db, candidate_id, lock=True)

            identity.full_name = DELETED_NAME
            identity.phone = None
            identity.avatar_url = None
            identity.deleted_at = now
            candidate.current_cv_id = None
            candidate.headline = None
            candidate.summary = None
            candidate.location_key = None
            candidate.unmapped_skills = []
            candidate.is_searchable = False
            candidate.deleted_at = now
            await self._db.flush()

            await self._db.execute(
                update(Cv)
                .where(Cv.candidate_id == candidate_id, Cv.deleted_at.is_(None))
                .values(deleted_at=now)
            )
            for section in (
                CandidateExperience,
                CandidateEducation,
                CandidateSkill,
                CandidateLanguage,
                CandidateProject,
            ):
                await self._db.execute(delete(section).where(section.candidate_id == candidate_id))

            await self._db.execute(
                delete(TalentPoolMember).where(TalentPoolMember.candidate_id == candidate_id)
            )
            await self._db.execute(
                delete(Notification).where(Notification.recipient_profile_id == candidate_id)
            )
            await self._db.execute(
                delete(CandidateProfileChunk).where(
                    CandidateProfileChunk.candidate_id == candidate_id
                )
            )
            await self._db.execute(
                delete(CandidateEmbeddingJob).where(
                    CandidateEmbeddingJob.candidate_id == candidate_id
                )
            )

    async def _ban_the_login(self, candidate_id: UUID) -> None:
        """After the scrub: a ban that failed would otherwise leave a login onto a blank account.

        The rows are already gone by the time this runs, so an unreachable GoTrue is logged rather
        than raised — the account reads as deleted everywhere, and the ban is retried by nobody.
        A stale access token still dies at `_load_profile`, which refuses a deleted Profile.
        """
        try:
            await self._gotrue.ban_user(candidate_id)
        except GoTrueUnavailableError:
            logger.error("candidates.ban_not_applied", candidate_id=str(candidate_id))
