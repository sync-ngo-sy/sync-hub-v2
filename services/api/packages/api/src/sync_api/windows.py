from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import func


def rolling_since(days: float) -> Any:
    """The instant a rolling window opened, on the database's clock.

    One definition for every window the platform offers, so a list narrowed to the last seven
    days and a count of the last seven days are the same Applications rather than two nearly
    equal answers.
    """
    return func.now() - timedelta(days=days)
