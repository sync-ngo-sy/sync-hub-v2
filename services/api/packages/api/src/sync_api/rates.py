from __future__ import annotations


def percentage(part: int, *, of: int) -> int | None:
    """A whole percentage, or nothing when there is nothing to be a percentage of.

    One definition for every rate the platform reports, so a Screening pass rate and a Tracked
    link's conversion round the same way and both refuse to answer over an empty denominator —
    a rate over nothing is not zero, it is unanswered.
    """
    return None if of == 0 else round(part * 100 / of)
