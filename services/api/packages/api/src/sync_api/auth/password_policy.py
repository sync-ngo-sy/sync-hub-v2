"""The password policy, in one place, for every path that sets a password.

The portals show a live checklist as the visitor types, but that is a courtesy. This module is
the boundary: nothing reaches the identity provider without passing it first.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Callable

MINIMUM_PASSWORD_LENGTH: Final = 8

MAXIMUM_PASSWORD_LENGTH: Final = 72

POLICY_SUMMARY: Final = (
    f"At least {MINIMUM_PASSWORD_LENGTH} characters, with an uppercase letter, a lowercase "
    "letter and a digit."
)

CONFORMING_EXAMPLE: Final = "CorrectHorse9"


@dataclass(frozen=True, slots=True)
class PasswordRule:
    name: str
    requirement: str
    holds: Callable[[str], bool]


RULES: Final = (
    PasswordRule(
        name="length",
        requirement=f"at least {MINIMUM_PASSWORD_LENGTH} characters",
        holds=lambda password: len(password) >= MINIMUM_PASSWORD_LENGTH,
    ),
    PasswordRule(
        name="uppercase",
        requirement="an uppercase letter",
        holds=lambda password: re.search(r"[A-Z]", password) is not None,
    ),
    PasswordRule(
        name="lowercase",
        requirement="a lowercase letter",
        holds=lambda password: re.search(r"[a-z]", password) is not None,
    ),
    PasswordRule(
        name="digit",
        requirement="a digit",
        holds=lambda password: re.search(r"[0-9]", password) is not None,
    ),
)


class PasswordPolicyError(Exception):
    """A password the policy refuses, carrying what it was missing."""

    def __init__(self, unmet: tuple[PasswordRule, ...]) -> None:
        self.unmet = unmet
        super().__init__(f"That password needs {_listed(unmet)}.")

    @property
    def requirements(self) -> tuple[str, ...]:
        return tuple(rule.requirement for rule in self.unmet)


def unmet_rules(password: str) -> tuple[PasswordRule, ...]:
    return tuple(rule for rule in RULES if not rule.holds(password))


def enforce_password_policy(password: str) -> None:
    unmet = unmet_rules(password)
    if unmet:
        raise PasswordPolicyError(unmet)


def _listed(rules: tuple[PasswordRule, ...]) -> str:
    requirements = [rule.requirement for rule in rules]
    if len(requirements) == 1:
        return requirements[0]
    return f"{', '.join(requirements[:-1])} and {requirements[-1]}"
