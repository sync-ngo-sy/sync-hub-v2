from __future__ import annotations

from typing import TYPE_CHECKING

from sync_core.models import AccountType

if TYPE_CHECKING:
    from sync_core import Settings


class Portals:
    """Which portal serves each kind of Profile.

    One answer, read by the Profile every portal loads and by the portal a password-reset link
    returns to. It used to be two: a branch here and a copy compiled into each portal's own
    configuration, which is how the Platform Portal ended up knowing no other portal's address.
    """

    def __init__(self, *, candidate: str, recruiter: str, platform_admin: str) -> None:
        self._urls = {
            AccountType.CANDIDATE: candidate,
            AccountType.RECRUITER: recruiter,
            AccountType.PLATFORM_ADMIN: platform_admin,
        }

    @classmethod
    def of(cls, settings: Settings) -> Portals:
        return cls(
            candidate=_origin(settings.candidate_portal_url),
            recruiter=_origin(settings.recruiter_portal_url),
            platform_admin=_origin(settings.admin_portal_url),
        )

    def url_for(self, account_type: AccountType) -> str:
        return self._urls[account_type]


def _origin(url: object) -> str:
    return str(url).rstrip("/")
