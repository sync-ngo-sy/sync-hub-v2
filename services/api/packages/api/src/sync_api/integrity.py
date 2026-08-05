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
    clash: IntegrityError, constraint: str, *also: str, problem_type: str, detail: str
) -> NoReturn:
    """A uniqueness a caller can walk into by choosing a name is a 409. Anything else the
    database refused is a bug of ours, and keeps being an error.

    More than one may be named, because one name can be unique in more than one way: a Tag's name
    is unique per scope exactly, and unique per scope case-insensitively, and whichever of the two
    the database happens to refuse on is the same 409 to whoever typed the name. At least one is
    required — a call naming none would turn every constraint in the schema into a re-raise.
    """
    if violated_constraint(clash) not in {constraint, *also}:
        raise clash
    raise Problem(status=409, type=problem_type, detail=detail) from clash
