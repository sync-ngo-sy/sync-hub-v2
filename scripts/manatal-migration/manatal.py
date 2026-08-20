"""Reading a Manatal account: the candidates it holds, and the resume behind each one."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlsplit

from httpx import AsyncClient, HTTPError, HTTPStatusError, Response

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

CANDIDATES_PATH: Final = "/candidates/"

#: Where Manatal has been seen to put each thing. Several spellings per field on purpose: its
#: API has shifted across versions and accounts differ, so this tries each rather than assuming
#: one. `migrate.py --inventory` reports what the account actually returns, which is how you
#: check this list against reality before trusting a run.
ID_KEYS: Final = ("id", "pk")
NAME_KEYS: Final = ("full_name", "name")
#: Manatal names the thing inside a list entry differently per list: `skill_name` in skills,
#: `tag_name` in tags. Reading only `name` here is how a whole field goes silently missing,
#: which is exactly what `--inventory` against a real account caught.
NAMED_KEYS: Final = ("skill_name", "tag_name", "name", "label", "title")
LOCATION_KEYS: Final = ("candidate_location", "address", "location")
COMPANY_KEYS: Final = ("current_company", "company")
DEGREE_KEYS: Final = ("latest_degree", "degree")
UNIVERSITY_KEYS: Final = ("latest_university", "university", "school")
DESCRIPTION_KEYS: Final = ("description", "summary", "notes")
PICTURE_KEYS: Final = ("picture", "photo", "avatar")
TAG_KEYS: Final = ("candidate_tags", "tags", "labels")

#: Custom fields are where this account keeps most of what its recruiters ask for. Manatal
#: flattens the label a recruiter typed into a key, so "Spoken English Proficiency Level"
#: arrives as `spokenenglishproficiencylevel`. Confirmed against the live account rather than
#: guessed: `--inventory` counts these one by one.
SPOKEN_ENGLISH_KEYS: Final = ("spokenenglishproficiencylevel", "spokenenglish")
WRITTEN_ENGLISH_KEYS: Final = ("writtenenglishproficiencylevel", "writtenenglish")
GRADUATION_YEAR_KEYS: Final = ("graduationyear", "graduation_year")
HIGHEST_DEGREE_KEYS: Final = ("highestdegree", "highest_degree")
LINKEDIN_KEYS: Final = ("linkedinprofile", "linkedin", "linkedin_url")
PHONE_KEYS: Final = ("phone_number", "phone", "mobile", "mobile_number")
HEADLINE_KEYS: Final = ("current_position", "job_title", "title", "headline")
SKILL_KEYS: Final = ("skills", "skill_set")

#: What the platform's `cvs` bucket accepts. A resume in anything else cannot become a CV here.
MEDIA_TYPES: Final[dict[str, str]] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
MEDIA_TYPE_BY_EXTENSION: Final[dict[str, str]] = {
    extension: media_type for media_type, extension in MEDIA_TYPES.items()
}

#: Anything in an error body that could be replayed if it reached a log.
SECRETS: Final = re.compile(r"(Token\s+)\S+|((?:Signature|X-Amz-[A-Za-z-]+)=)[^&\s]+")


@dataclass(frozen=True, slots=True)
class Candidate:
    """One candidate as Manatal describes them.

    `email` is what an account gets made from, and Manatal does not guarantee one — an empty
    string is a candidate this migration cannot bring across, not a bug.
    """

    external_id: str
    full_name: str
    email: str
    updated_at: datetime | None = None
    headline: str | None = None
    phone: str | None = None
    #: Free text as Manatal words it: "Mersin, Turkey". The platform keys location to a
    #: taxonomy, so this is matched against it rather than stored as typed.
    location: str | None = None
    current_company: str | None = None
    #: The one qualification Manatal keeps as fields rather than inside the CV.
    latest_degree: str | None = None
    latest_university: str | None = None
    #: Whatever a recruiter typed about them in Manatal.
    description: str | None = None
    picture_url: str | None = None
    tags: tuple[str, ...] = ()
    #: How well they read and write English, as this account's own custom fields put it.
    #: Free text like "Intermediate - comfortable work conversations", mapped to the
    #: platform's own proficiency scale rather than stored as typed.
    english_spoken: str | None = None
    english_written: str | None = None
    graduation_year: int | None = None
    linkedin_url: str | None = None
    #: Free-text skills as Manatal words them. This platform keys skills to a taxonomy, so the
    #: ones it does not recognise belong in `candidates.unmapped_skills` — which is what these
    #: are until a CV parse maps some of them.
    skills: tuple[str, ...] = ()
    #: The record exactly as Manatal returned it, carried so the migration can archive every
    #: field — including the ones this platform has no home for. After Manatal is switched off
    #: an unarchived field is gone for good; an archived one can still be backfilled.
    raw: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class Resume:
    filename: str
    media_type: str
    content: bytes


class ManatalError(Exception):
    pass


class ManatalUnavailableError(ManatalError):
    """Manatal did not answer, or answered in a way that may work next time."""


class CandidateGoneError(ManatalError):
    """Manatal has no such candidate. Asking again will not change that."""


class ResumeMissingError(ManatalError):
    """No resume to read: none attached, or one in a format this platform cannot open."""


class Manatal:
    """The Manatal API, over nothing but HTTP.

    Two hosts are involved and only one may see the token: the API mints a short-lived download
    URL, and that URL is object storage somebody else operates. So the token goes on each API
    request rather than sitting on the client.
    """

    def __init__(self, http: AsyncClient, *, base_url: str, token: str, page_size: int) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._page_size = page_size

    @classmethod
    def build(cls, *, base_url: str, token: str, timeout_seconds: float, page_size: int) -> Manatal:
        return cls(
            AsyncClient(timeout=timeout_seconds, follow_redirects=True),
            base_url=base_url,
            token=token,
            page_size=page_size,
        )

    async def everyone(self, *, limit: int) -> list[Candidate]:
        """Every candidate in the account, up to `limit`, following Manatal's own paging."""
        found: list[Candidate] = []
        url: str | None = f"{self._base_url}{CANDIDATES_PATH}"
        params: dict[str, str] | None = {"page_size": str(self._page_size)}
        while url is not None and len(found) < limit:
            page = _record(_json(_checked(await self._api(url, params=params))))
            found += [
                candidate
                for candidate in (_candidate(_record(row)) for row in _rows(page))
                if candidate.external_id
            ]
            # Manatal's `next` is absolute and carries the paging it was asked for already.
            url = _text(page.get("next")) or None
            params = None
        return found[:limit]

    async def candidate(self, external_id: str) -> Candidate:
        answered = await self._api(f"{CANDIDATES_PATH}{external_id}/")
        if answered.status_code == 404:
            raise CandidateGoneError(f"Manatal has no candidate {external_id}")
        return _candidate(_record(_json(_checked(answered))))

    async def resume(self, candidate: Candidate) -> Resume:
        """The resume as bytes, through a URL minted for this call.

        Manatal answers either with the file or with JSON naming where the file is. The second is
        the common case, and the URL in it expires — which is why nothing stores one.
        """
        answered = await self._api(f"{CANDIDATES_PATH}{candidate.external_id}/resume/")
        if answered.status_code == 404:
            raise ResumeMissingError(f"Manatal holds no resume for {candidate.external_id}")
        answered = _checked(answered)
        if "json" in answered.headers.get("content-type", "").lower():
            answered = _checked(await self._download(_resume_url(answered, candidate)))
        return _resume(answered, candidate)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _api(self, path_or_url: str, *, params: Mapping[str, str] | None = None) -> Response:
        url = path_or_url if _absolute(path_or_url) else f"{self._base_url}{path_or_url}"
        return await self._get(
            url, headers={"Authorization": f"Token {self._token}"}, params=params
        )

    async def _download(self, url: str) -> Response:
        return await self._get(url)

    async def _get(
        self,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        params: Mapping[str, str] | None = None,
    ) -> Response:
        try:
            return await self._http.get(
                url, headers={"Accept": "application/json", **(headers or {})}, params=params
            )
        except HTTPError as unreachable:
            raise ManatalUnavailableError(
                f"Manatal did not answer {_without_query(url)}: {type(unreachable).__name__}"
            ) from unreachable


def _checked(answered: Response) -> Response:
    try:
        answered.raise_for_status()
    except HTTPStatusError as refused:
        url = _without_query(str(answered.request.url))
        raise ManatalUnavailableError(
            f"Manatal answered {answered.status_code} for {url}: {_redacted(answered.text)}"
        ) from refused
    return answered


def _resume_url(answered: Response, candidate: Candidate) -> str:
    named = _record(_json(answered))
    for key in ("url", "resume", "resume_url", "file", "file_url", "download_url"):
        found = _text(named.get(key))
        if _absolute(found):
            return found
    raise ResumeMissingError(f"Manatal named no resume file for {candidate.external_id}")


def _resume(answered: Response, candidate: Candidate) -> Resume:
    filename = _filename(answered, candidate)
    media_type = _media_type(answered, filename)
    if media_type is None:
        suffix = PurePosixPath(filename).suffix or "file"
        raise ResumeMissingError(
            f"Manatal's resume for {candidate.external_id} is a {suffix}, "
            "which this platform cannot read"
        )
    if not answered.content:
        raise ResumeMissingError(f"Manatal's resume for {candidate.external_id} is empty")
    return Resume(filename=filename, media_type=media_type, content=answered.content)


def _filename(answered: Response, candidate: Candidate) -> str:
    disposition = answered.headers.get("content-disposition", "")
    quoted = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', disposition)
    named = (
        quoted.group(1).strip() if quoted else PurePosixPath(urlsplit(str(answered.url)).path).name
    )
    return PurePosixPath(named).name or f"manatal-{candidate.external_id}"


def _media_type(answered: Response, filename: str) -> str | None:
    declared = answered.headers.get("content-type", "").split(";")[0].strip().lower()
    if declared in MEDIA_TYPES:
        return declared
    return MEDIA_TYPE_BY_EXTENSION.get(PurePosixPath(filename).suffix.lower())


def _candidate(record: Mapping[str, Any]) -> Candidate:
    return Candidate(
        external_id=_first(record, ID_KEYS),
        full_name=_full_name(record),
        email=_email(record),
        updated_at=_moment(record.get("updated_at")) or _moment(record.get("created_at")),
        headline=_first(record, HEADLINE_KEYS) or None,
        phone=_first(record, PHONE_KEYS) or None,
        skills=_named_list(record, SKILL_KEYS),
        location=_first(record, LOCATION_KEYS) or None,
        current_company=_first(record, COMPANY_KEYS) or None,
        latest_degree=_first(record, DEGREE_KEYS) or None,
        latest_university=_first(record, UNIVERSITY_KEYS) or None,
        description=_first(record, DESCRIPTION_KEYS) or None,
        picture_url=_first(record, PICTURE_KEYS) or None,
        tags=_named_list(record, TAG_KEYS),
        english_spoken=_custom(record, SPOKEN_ENGLISH_KEYS) or None,
        english_written=_custom(record, WRITTEN_ENGLISH_KEYS) or None,
        graduation_year=_year(_custom(record, GRADUATION_YEAR_KEYS)),
        linkedin_url=_custom(record, LINKEDIN_KEYS) or _first(record, LINKEDIN_KEYS) or None,
        raw=record,
    )


def _custom(record: Mapping[str, Any], keys: Sequence[str]) -> str:
    """A value out of the custom fields blob, by any of the keys it might carry."""
    custom = record.get("custom_fields")
    return _first(custom, keys) if isinstance(custom, dict) else ""


def _year(stated: str) -> int | None:
    """Manatal stores a graduation year as a whole date. Only the year has a home here."""
    digits = stated.strip()[:4]
    return int(digits) if digits.isdigit() and 1900 <= int(digits) <= 2100 else None


def _first(record: Mapping[str, Any], keys: Sequence[str]) -> str:
    """The first of these keys the record actually carries."""
    for key in keys:
        found = _text(record.get(key))
        if found:
            return found
    return ""


def _named_list(record: Mapping[str, Any], keys: Sequence[str]) -> tuple[str, ...]:
    """A list Manatal keeps as strings, or as objects naming the thing. Deduplicated, in order."""
    for key in keys:
        listed = record.get(key)
        if not isinstance(listed, list):
            continue
        named = [
            _first(entry, NAMED_KEYS) if isinstance(entry, dict) else _text(entry)
            for entry in listed
        ]
        kept = tuple(dict.fromkeys(name for name in named if name))
        if kept:
            return kept
    return ()


def _full_name(record: Mapping[str, Any]) -> str:
    stated = _first(record, NAME_KEYS)
    if stated:
        return stated
    parts = (_text(record.get("first_name")), _text(record.get("last_name")))
    return " ".join(part for part in parts if part)


def _email(record: Mapping[str, Any]) -> str:
    stated = _text(record.get("email"))
    if stated:
        return stated
    listed = record.get("emails")
    if isinstance(listed, list):
        return next((_text(entry) for entry in listed if _text(entry)), "")
    return ""


def _json(answered: Response) -> object:
    try:
        return answered.json()
    except ValueError as unreadable:
        raise ManatalUnavailableError("Manatal answered with something that is not JSON") from (
            unreadable
        )


def _record(payload: object) -> Mapping[str, Any]:
    return payload if isinstance(payload, dict) else {}


def _rows(page: Mapping[str, Any]) -> Sequence[object]:
    listed = page.get("results") or page.get("data")
    return listed if isinstance(listed, list) else []


def _text(value: object) -> str:
    return str(value).strip() if isinstance(value, str | int) else ""


def _moment(value: object) -> datetime | None:
    stated = _text(value)
    if not stated:
        return None
    try:
        parsed = datetime.fromisoformat(stated.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _absolute(url: str) -> bool:
    return url.startswith(("http://", "https://"))


def _without_query(url: str) -> str:
    split = urlsplit(url)
    return f"{split.scheme}://{split.netloc}{split.path}"


def _redacted(text: str) -> str:
    return SECRETS.sub(lambda found: f"{found.group(1) or found.group(2)}[redacted]", text)[:500]
