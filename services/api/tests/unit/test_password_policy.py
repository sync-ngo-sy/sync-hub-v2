from __future__ import annotations

import pytest

from sync_api.auth.password_policy import (
    CONFORMING_EXAMPLE,
    PasswordPolicyError,
    enforce_password_policy,
    unmet_rules,
)

CONFORMING = "CorrectHorse9"


def names(password: str) -> set[str]:
    return {rule.name for rule in unmet_rules(password)}


def test_a_conforming_password_leaves_nothing_unmet() -> None:
    assert names(CONFORMING) == set()


def test_the_documented_example_conforms() -> None:
    assert names(CONFORMING_EXAMPLE) == set()


@pytest.mark.parametrize(
    ("password", "unmet"),
    [
        ("Ab1defg", {"length"}),
        ("correcthorse9", {"uppercase"}),
        ("CORRECTHORSE9", {"lowercase"}),
        ("CorrectHorse", {"digit"}),
        ("", {"length", "uppercase", "lowercase", "digit"}),
    ],
)
def test_each_rule_is_reported_on_its_own(password: str, unmet: set[str]) -> None:
    assert names(password) == unmet


def test_a_special_character_is_welcome_but_never_required() -> None:
    assert names("Correct-Horse9") == set()
    assert names("CorrectHorse9") == set()


def test_enforcing_a_conforming_password_raises_nothing() -> None:
    enforce_password_policy(CONFORMING)


def test_the_refusal_names_every_missing_requirement() -> None:
    with pytest.raises(PasswordPolicyError) as refused:
        enforce_password_policy("horse")

    assert refused.value.requirements == (
        "at least 8 characters",
        "an uppercase letter",
        "a digit",
    )
    assert str(refused.value) == (
        "That password needs at least 8 characters, an uppercase letter and a digit."
    )


def test_a_single_missing_requirement_reads_as_a_sentence() -> None:
    with pytest.raises(PasswordPolicyError) as refused:
        enforce_password_policy("CorrectHorse")

    assert str(refused.value) == "That password needs a digit."
