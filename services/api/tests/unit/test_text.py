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


@pytest.mark.parametrize("value", ["a\x00b", "\x00", "a\x01b", "a\x1bb", "a\x7fb", "a\x85b"])
def test_a_line_refuses_every_control_character(value: str) -> None:
    with pytest.raises(ValidationError):
        line.validate_python(value)


def test_a_line_keeps_a_tab_as_content() -> None:
    assert line.validate_python("Senior\tEngineer") == "Senior\tEngineer"


def test_a_paragraph_keeps_line_breaks_and_tabs_as_content() -> None:
    written = "Strong on payments.\r\nRan the ledger rewrite.\tTwice."
    assert paragraph.validate_python(written) == written


def test_a_paragraph_refuses_a_null_byte_between_legitimate_lines() -> None:
    with pytest.raises(ValidationError):
        paragraph.validate_python("one\r\n\x00two")


def test_a_link_refuses_a_control_character() -> None:
    with pytest.raises(ValidationError):
        link.validate_python("https://amina-haddad.dev/\x00")


def test_an_optional_line_passes_none_through() -> None:
    assert TypeAdapter(OptionalLine).validate_python(None) is None


def test_an_optional_paragraph_refuses_a_control_character() -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(OptionalParagraph).validate_python("a\x00b")


def test_a_language_code_refuses_a_null_byte() -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(LanguageCode).validate_python("e\x00n")
