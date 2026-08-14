"""Turning an account's own words about English into the scale a Job can require."""

from __future__ import annotations

import pytest

from profile_rows import proficiency_of

#: Real values from the account, and the shapes near them.
AS_WRITTEN = [
    ("Intermediate - comfortable work conversations with some hesitation", "intermediate"),
    ("Advanced - can hold a technical discussion", "advanced"),
    ("Fluent", "fluent"),
    ("Native speaker", "native"),
    ("Basic - a few words", "beginner"),
    ("Bilingual", "native"),
    ("Professional working proficiency", "fluent"),
    ("Elementary", "beginner"),
    ("conversational", "intermediate"),
]


@pytest.mark.parametrize(("stated", "expected"), AS_WRITTEN)
def test_the_word_it_leads_with_is_what_maps(stated: str, expected: str) -> None:
    assert proficiency_of(stated) == expected


def test_the_stronger_of_speaking_and_writing_is_the_one_kept() -> None:
    """One row per language, two fields describing it — so this keeps the level they have
    shown in at least one direction, and the Note keeps both in full."""
    assert proficiency_of("Basic - a few words", "Fluent") == "fluent"
    assert proficiency_of("Native", "Intermediate") == "native"
    assert proficiency_of("Advanced", "Advanced") == "advanced"


def test_wording_nobody_recognises_is_left_out_rather_than_guessed() -> None:
    """A wrong proficiency is worse than an absent one: a Job can require a level, and a
    Candidate wrongly marked fluent is screened in on something nobody claimed."""
    assert proficiency_of("Somewhere in the middle") is None
    assert proficiency_of("") is None
    assert proficiency_of(None) is None
    assert proficiency_of(None, None) is None


def test_one_unreadable_answer_does_not_lose_the_readable_one() -> None:
    assert proficiency_of("Somewhere in the middle", "Advanced") == "advanced"


def test_punctuation_and_case_do_not_change_the_answer() -> None:
    assert proficiency_of("FLUENT:") == "fluent"
    assert proficiency_of("  native ") == "native"
    assert proficiency_of("Intermediate,") == "intermediate"
