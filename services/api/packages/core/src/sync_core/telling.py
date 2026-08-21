from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from datetime import datetime

#: How long a Candidate has between a Tenant taking a rejection and hearing it. One
#: platform-wide number rather than a Tenant's to set: a Candidate hears from several Tenants
#: through Sync, and a wait that varied by employer would read as arbitrary to the person
#: waiting.
TELLING_DELAY: Final = timedelta(days=3)


def the_telling_after(decided_at: datetime) -> datetime:
    """When a rejection taken at `decided_at` reaches the Candidate."""
    return decided_at + TELLING_DELAY


def told(told_at: datetime | None, now: datetime) -> bool:
    """Whether the Telling has come. A rejection carrying no Telling has nothing to wait for."""
    return told_at is None or told_at <= now
