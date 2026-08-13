"""Telling somebody watching a long run how far it has got and when it will end.

5,000 candidates is long enough that silence is indistinguishable from a hang. This is the
difference: a line per batch with a count, a rate and an estimate, all derived from what has
actually finished rather than from an average anybody guessed.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field

#: Nothing sensible can be extrapolated from a couple of samples, so the estimate waits.
ENOUGH_TO_ESTIMATE = 5


@dataclass
class Progress:
    """How far through, how fast, and how much longer."""

    total: int
    done: int = 0
    #: Injectable so the clock can be pinned in a test; nothing else has a reason to pass it.
    _now: Callable[[], float] = field(default=time.monotonic, repr=False)
    _started_at: float = field(default=0.0, repr=False)

    def __post_init__(self) -> None:
        # Read through `_now` rather than a default factory, so a pinned clock starts the run
        # at its own zero instead of the real one.
        self._started_at = self._now()

    def advance(self, by: int = 1) -> None:
        self.done = min(self.done + by, self.total)

    @property
    def elapsed(self) -> float:
        return max(self._now() - self._started_at, 0.0)

    @property
    def per_second(self) -> float:
        return 0.0 if self.elapsed <= 0 else self.done / self.elapsed

    @property
    def remaining(self) -> int:
        return max(self.total - self.done, 0)

    @property
    def eta_seconds(self) -> float | None:
        """None until enough has finished to extrapolate honestly."""
        if self.done < ENOUGH_TO_ESTIMATE or self.per_second <= 0 or not self.remaining:
            return None
        return self.remaining / self.per_second

    @property
    def percent(self) -> float:
        return 0.0 if self.total <= 0 else self.done / self.total

    def line(self) -> str:
        parts = [f"{self.done}/{self.total} ({self.percent:.0%})"]
        if self.per_second > 0:
            parts.append(f"{self.per_second:.1f}/s")
        eta = self.eta_seconds
        if eta is not None:
            parts.append(f"about {duration(eta)} left")
        return "  " + " · ".join(parts)


def duration(seconds: float) -> str:
    """Rounded the way somebody waiting would say it."""
    if seconds < 60:
        return f"{round(seconds)}s"
    if seconds < 3600:
        return f"{round(seconds / 60)}m"
    hours, minutes = divmod(round(seconds / 60), 60)
    return f"{hours}h {minutes}m" if minutes else f"{hours}h"
