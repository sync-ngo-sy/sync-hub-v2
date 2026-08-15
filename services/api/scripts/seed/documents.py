"""The CV files a seeded Candidate actually uploaded, and the CV text inside them.

A seed that wrote `parsed_cv_data` with no file behind it would leave every download link
answering 502, so each Candidate gets a real document — built from the very profile they were
seeded with, so the file, the parse and the profile all say the same thing. That is what a CV
which has been through review looks like, and it is the state most of the product assumes.

Both writers are deliberately minimal, in the shape of the fixtures in `tests/fixtures/cvs`:
one page description per format and no new dependency. PDF text is Helvetica in the standard
encoding, which has no glyph for a dash somebody pasted out of a word processor, so lines are
transliterated to ASCII rather than left to a viewer's replacement box.
"""

from __future__ import annotations

import unicodedata
import zipfile
from io import BytesIO
from typing import TYPE_CHECKING, Final
from xml.sax.saxutils import escape

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence

    from sync_api.candidates import CandidateProfile

PAGE_WIDTH: Final = 595
PAGE_HEIGHT: Final = 842
MARGIN: Final = 56
FIRST_BASELINE: Final = PAGE_HEIGHT - MARGIN - 4
FONT_SIZE: Final = 11
LEADING: Final = 14

#: How many baselines fit between the first one and the bottom margin.
LINES_A_PAGE: Final = (FIRST_BASELINE - MARGIN) // LEADING

#: The objects every page refers back to, so a page's own object number starts after them.
CATALOG, PAGES, FONT = 1, 2, 3
FIRST_PAGE_OBJECT: Final = 4

#: Typography a word processor produces and the standard encoding has no glyph for.
_PUNCTUATION: Final[dict[str, str]] = {
    "—": "-",
    "–": "-",  # noqa: RUF001
    "’": "'",  # noqa: RUF001
    "‘": "'",  # noqa: RUF001
    "“": '"',
    "”": '"',
    "…": "...",
    " ": " ",  # noqa: RUF001
    "•": "-",
}

_CONTENT_TYPES: Final = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
    '<Default Extension="rels" '
    'ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
    '<Default Extension="xml" ContentType="application/xml"/>\n'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-'
    'officedocument.wordprocessingml.document.main+xml"/>\n'
    "</Types>"
)

_RELATIONSHIPS: Final = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
    'relationships/officeDocument" Target="word/document.xml"/>\n'
    "</Relationships>"
)

_WORD_NAMESPACE: Final = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

#: Fixed, so the same profile always produces the same bytes — and therefore the same
#: `cvs.file_hash`, which is what makes re-running the seed idempotent rather than duplicating.
_ARCHIVED_AT: Final = (2026, 1, 1, 0, 0, 0)


def as_pdf(lines: Sequence[str]) -> bytes:
    """The lines as a paginated PDF, with a cross-reference table a strict reader will accept."""
    pages = list(_paginated([_plain(line) for line in lines]))
    objects: list[bytes] = [
        f"<< /Type /Catalog /Pages {PAGES} 0 R >>".encode(),
        _pages_object(len(pages)),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    for index, page in enumerate(pages):
        objects.append(_page_object(_contents_object_number(index)))
        objects.append(_stream_object(_content_stream(page)))
    return _serialised(objects)


def as_docx(lines: Sequence[str]) -> bytes:
    """The lines as the smallest well-formed .docx: three parts, one paragraph per line."""
    body = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>' for line in lines
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<w:document xmlns:w="{_WORD_NAMESPACE}"><w:body>{body}</w:body></w:document>'
    )
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, part in (
            ("[Content_Types].xml", _CONTENT_TYPES),
            ("_rels/.rels", _RELATIONSHIPS),
            ("word/document.xml", document),
        ):
            archive.writestr(zipfile.ZipInfo(name, date_time=_ARCHIVED_AT), part)
    return buffer.getvalue()


def cv_lines(profile: CandidateProfile, *, email: str, location: str | None = None) -> list[str]:
    """One profile written out as the CV it came from.

    Deliberately derived rather than authored: a hand-written CV and a hand-written profile
    drift apart on the first edit, and a Recruiter comparing the two would be reading a
    discrepancy the seed invented rather than one the product allows.

    `location` is the Location's *name*, which the profile does not hold — it holds the key, and
    "sy-damascus" is not a thing anybody writes on a CV.
    """
    written = [profile.full_name, " | ".join(_contact(profile, email, location))]
    if profile.headline:
        written += ["", profile.headline]
    if profile.summary:
        written += ["", *_wrapped(profile.summary)]

    if profile.experiences:
        written += ["", "EXPERIENCE"]
        for entry in profile.experiences:
            held = (
                f"{entry.job_title}, {entry.company_name}"
                if entry.company_name
                else entry.job_title
            )
            written += ["", f"{held}  ({_period(entry)})"]
            written += _wrapped(entry.description) if entry.description else []

    if profile.educations:
        written += ["", "EDUCATION"]
        for entry in profile.educations:
            qualification = " in ".join(
                part for part in (entry.degree, entry.field_of_study) if part
            )
            studied = (
                f"{qualification}, {entry.institution}" if qualification else entry.institution
            )
            year = f" ({entry.graduation_year})" if entry.graduation_year else ""
            written.append(f"{studied}{year}")

    named = [f"{skill.name} ({skill.years_experience:g}y)" for skill in profile.skills]
    if named or profile.unmapped_skills:
        written += ["", "SKILLS", *_wrapped(", ".join([*named, *profile.unmapped_skills]))]

    if profile.languages:
        spoken = ", ".join(
            f"{entry.code.upper()} ({entry.proficiency.value})" for entry in profile.languages
        )
        written += ["", "LANGUAGES", spoken]

    if profile.projects:
        written += ["", "PROJECTS"]
        for entry in profile.projects:
            written += ["", f"{entry.name}  ({_period(entry)})"]
            written += _wrapped(entry.description) if entry.description else []
            written += [link for link in (entry.project_url, entry.repository_url) if link]

    return written


def _contact(profile: CandidateProfile, email: str, location: str | None) -> list[str]:
    links = (profile.linkedin_url, profile.github_url, profile.portfolio_url)
    return [part for part in (email, profile.phone, location, *links) if part]


def _period(entry: object) -> str:
    start = _month(getattr(entry, "start_year", None), getattr(entry, "start_month", None))
    if getattr(entry, "is_current", False):
        return f"{start or 'date not stated'} - Present"
    end = _month(getattr(entry, "end_year", None), getattr(entry, "end_month", None))
    if start and end:
        return f"{start} - {end}"
    return start or end or "dates not stated"


_MONTHS: Final = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)  # fmt: skip


def _month(year: int | None, month: int | None) -> str:
    if year is None:
        return ""
    return f"{_MONTHS[month - 1]} {year}" if month else str(year)


def _wrapped(prose: str, *, width: int = 78) -> list[str]:
    """Wrapped by hand rather than by `textwrap`: the paragraphs a profile holds are already
    written with their own line breaks, and those are the author's."""
    lines: list[str] = []
    for paragraph in prose.splitlines():
        current = ""
        for word in paragraph.split():
            candidate = f"{current} {word}".strip()
            if len(candidate) > width and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current)
    return lines


def _paginated(lines: Sequence[str]) -> Iterator[Sequence[str]]:
    for start in range(0, max(len(lines), 1), LINES_A_PAGE):
        yield lines[start : start + LINES_A_PAGE]


def _contents_object_number(page_index: int) -> int:
    return FIRST_PAGE_OBJECT + page_index * 2 + 1


def _pages_object(pages: int) -> bytes:
    kids = " ".join(f"{FIRST_PAGE_OBJECT + index * 2} 0 R" for index in range(pages))
    return f"<< /Type /Pages /Kids [{kids}] /Count {pages} >>".encode()


def _page_object(contents: int) -> bytes:
    return (
        f"<< /Type /Page /Parent {PAGES} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
        f"/Resources << /Font << /F1 {FONT} 0 R >> >> /Contents {contents} 0 R >>"
    ).encode()


def _stream_object(stream: bytes) -> bytes:
    return b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)


def _content_stream(lines: Sequence[str]) -> bytes:
    written = [
        b"BT",
        f"/F1 {FONT_SIZE} Tf".encode(),
        f"{LEADING} TL".encode(),
        f"{MARGIN} {FIRST_BASELINE} Td".encode(),
    ]
    for line in lines:
        written += [b"(" + _escaped(line).encode("ascii") + b") Tj", b"T*"]
    written.append(b"ET")
    return b"\n".join(written)


def _serialised(objects: Sequence[bytes]) -> bytes:
    """The objects, each at a recorded offset, and the table that points a reader at them."""
    written = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(written))
        written += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"

    table_at = len(written)
    written += f"xref\n0 {len(objects) + 1}\n".encode()
    written += b"0000000000 65535 f \n"
    for offset in offsets:
        written += f"{offset:010d} 00000 n \n".encode()
    written += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {CATALOG} 0 R >>\n"
        f"startxref\n{table_at}\n%%EOF\n"
    ).encode()
    return bytes(written)


def _escaped(line: str) -> str:
    for character in ("\\", "(", ")"):
        line = line.replace(character, f"\\{character}")
    return line


def _plain(line: str) -> str:
    for typed, plain in _PUNCTUATION.items():
        line = line.replace(typed, plain)
    decomposed = unicodedata.normalize("NFKD", line)
    return "".join(
        character for character in decomposed if character.isascii() and character.isprintable()
    )
