from __future__ import annotations

from typing import TYPE_CHECKING, NoReturn

from sync_api.problems import Problem

if TYPE_CHECKING:
    from sqlalchemy.exc import IntegrityError


def violated_constraint(exc: IntegrityError) -> str | None:
    """The name of the constraint the database refused a write on, if it names one."""
    error: BaseException | None = exc.orig
    while error is not None:
        name = getattr(error, "constraint_name", None)
        if isinstance(name, str):
            return name
        error = error.__cause__
    return None


def refuse_duplicate(
    clash: IntegrityError, constraint: str, *, problem_type: str, detail: str
) -> NoReturn:
    """A uniqueness a caller can walk into by choosing a name is a 409. Anything else the
    database refused is a bug of ours, and keeps being an error."""
    if violated_constraint(clash) != constraint:
        raise clash
    raise Problem(status=409, type=problem_type, detail=detail) from clash
