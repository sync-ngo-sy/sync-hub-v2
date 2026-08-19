from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from sync_api.text import (
    LanguageCode,
    Line,
    Link,
    OptionalLine,
    OptionalParagraph,
    Paragraph,
)

line = TypeAdapter(Line)
paragraph = TypeAdapter(Paragraph)
link = TypeAdapter(Link)


@pytest.mark.parametrize("value", ["a\x00b", "a\x01b", "a\x1bb", "a\x7fb", "a\x85b"])
def test_a_line_cuts_out_every_control_character(value: str) -> None:
    assert line.validate_python(value) == "ab"


def test_a_line_keeps_a_tab_as_content() -> None:
    assert line.validate_python("Senior\tEngineer") == "Senior\tEngineer"


def test_a_line_refuses_whitespace_only_content() -> None:
    with pytest.raises(ValidationError):
        line.validate_python("   ")


def test_a_line_refuses_content_that_was_only_control_characters() -> None:
    with pytest.raises(ValidationError):
        line.validate_python("\x00\x01")


def test_a_line_measures_the_length_it_keeps() -> None:
    assert line.validate_python("Senior Engineer\x0c") == "Senior Engineer"


def test_a_paragraph_keeps_line_breaks_and_tabs_as_content() -> None:
    written = "Strong on payments.\r\nRan the ledger rewrite.\tTwice."
    assert paragraph.validate_python(written) == written


def test_a_paragraph_keeps_both_lines_a_null_byte_sat_between() -> None:
    assert paragraph.validate_python("one\r\n\x00two") == "one\r\ntwo"


def test_a_paragraph_keeps_a_page_break_pasted_out_of_a_pdf() -> None:
    pasted = "Page one ends.\n\x0cPage two starts."
    assert paragraph.validate_python(pasted) == "Page one ends.\nPage two starts."


def test_a_link_cuts_out_a_control_character() -> None:
    assert link.validate_python("https://amina-haddad.dev/\x00") == "https://amina-haddad.dev/"


def test_an_optional_line_passes_none_through() -> None:
    assert TypeAdapter(OptionalLine).validate_python(None) is None


def test_an_optional_paragraph_cuts_out_a_control_character() -> None:
    assert TypeAdapter(OptionalParagraph).validate_python("a\x00b") == "ab"


def test_a_language_code_cuts_out_a_null_byte() -> None:
    assert TypeAdapter(LanguageCode).validate_python("e\x00n") == "en"


def test_a_line_refuses_what_was_never_a_string() -> None:
    with pytest.raises(ValidationError):
        line.validate_python(7)
