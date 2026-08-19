"""What a failed job is allowed to write into `error_message`.

The text comes from an exception, and an exception's text is not always ours: a model's refusal
of a CV is quoted into it verbatim.
"""

from __future__ import annotations

from sync_worker.engine import MAX_ERROR_LENGTH, failure_reason


def test_a_reason_names_the_exception_and_what_it_said() -> None:
    assert failure_reason(ValueError("the file is not a CV")) == "ValueError: the file is not a CV"


def test_a_reason_names_an_exception_that_said_nothing() -> None:
    assert failure_reason(TimeoutError()) == "TimeoutError"


def test_a_reason_carries_no_control_character_into_the_column() -> None:
    assert failure_reason(ValueError("read\x00the file")) == "ValueError: read the file"


def test_a_reason_is_bounded() -> None:
    assert len(failure_reason(ValueError("x" * (MAX_ERROR_LENGTH * 2)))) == MAX_ERROR_LENGTH
