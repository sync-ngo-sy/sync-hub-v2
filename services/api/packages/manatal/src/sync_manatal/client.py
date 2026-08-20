from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Any, Final
from urllib.parse import urlsplit

from httpx import AsyncClient, HTTPError, HTTPStatusError, Response

CANDIDATES_PATH: Final = "/candidates/"
ID_KEYS: Final = ("id", "pk")
NAME_KEYS: Final = ("full_name", "name")
NAMED_KEYS: Final = ("skill_name", "tag_name", "name", "label", "title")
LOCATION_KEYS: Final = ("candidate_location", "address", "location")
COMPANY_KEYS: Final = ("current_company", "company")
DEGREE_KEYS: Final = ("latest_degree", "degree")
UNIVERSITY_KEYS: Final = ("latest_university", "university", "school")
DESCRIPTION_KEYS: Final = ("description", "summary", "notes")
PICTURE_KEYS: Final = ("picture", "photo", "avatar")
TAG_KEYS: Final = ("candidate_tags", "tags", "labels")
SPOKEN_ENGLISH_KEYS: Final = ("spokenenglishproficiencylevel", "spokenenglish")
WRITTEN_ENGLISH_KEYS: Final = ("writtenenglishproficiencylevel", "writtenenglish")
GRADUATION_YEAR_KEYS: Final = ("graduationyear", "graduation_year")
HIGHEST_DEGREE_KEYS: Final = ("highestdegree", "highest_degree")
LINKEDIN_KEYS: Final = ("linkedinprofile", "linkedin", "linkedin_url")
PHONE_KEYS: Final = ("phone_number", "phone", "mobile", "mobile_number")
HEADLINE_KEYS: Final = ("current_position", "job_title", "title", "headline")
SKILL_KEYS: Final = ("skills", "skill_set")
MEDIA_TYPES: Final[dict[str, str]] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
MEDIA_TYPE_BY_EXTENSION: Final[dict[str, str]] = {
    extension: media_type for media_type, extension in MEDIA_TYPES.items()
}


class ManatalError(Exception):
    pass


class ManatalUnavailableError(ManatalError):
    pass


class ResumeMissingError(ManatalError):
    pass


@dataclass(frozen=True, slots=True)
class ManatalCandidate:
    external_id: str
    full_name: str
    email: str
    headline: str | None = None
    phone: str | None = None
    location: str | None = None
    current_company: str | None = None
    latest_degree: str | None = None
    latest_university: str | None = None
    description: str | None = None
    picture_url: str | None = None
    tags: tuple[str, ...] = ()
    english_spoken: str | None = None
    english_written: str | None = None
    graduation_year: int | None = None
    linkedin_url: str | None = None
    skills: tuple[str, ...] = ()
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ManatalResume:
    filename: str
    media_type: str
    content: bytes


class ManatalClient:
    def __init__(self, http: AsyncClient, *, base_url: str, token: str, page_size: int) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._page_size = page_size

    @classmethod
    def build(
        cls, *, base_url: str, token: str, timeout_seconds: float, page_size: int
    ) -> ManatalClient:
        return cls(
            AsyncClient(timeout=timeout_seconds, follow_redirects=True),
            base_url=base_url,
            token=token,
            page_size=page_size,
        )

    async def everyone(self, *, limit: int) -> list[ManatalCandidate]:
        found: list[ManatalCandidate] = []
        url: str | None = f"{self._base_url}{CANDIDATES_PATH}"
        params: dict[str, str] | None = {"page_size": str(self._page_size)}
        while url is not None and len(found) < limit:
            page = _record(_json(_checked(await self._api(url, params=params))))
            found += [
                candidate
                for candidate in (_candidate(_record(row)) for row in _rows(page))
                if candidate.external_id
            ]
            url = _text(page.get("next")) or None
            params = None
        return found[:limit]

    async def candidate(self, external_id: str) -> ManatalCandidate:
        answered = await self._api(f"{CANDIDATES_PATH}{external_id}/")
        if answered.status_code == 404:
            raise ManatalError(f"Manatal has no candidate {external_id}")
        return _candidate(_record(_json(_checked(answered))))

    async def resume(self, candidate: ManatalCandidate) -> ManatalResume:
        answered = await self._api(f"{CANDIDATES_PATH}{candidate.external_id}/resume/")
        if answered.status_code == 404:
            raise ResumeMissingError(f"Manatal holds no resume for {candidate.external_id}")
        answered = _checked(answered)
        if "json" in answered.headers.get("content-type", "").lower():
            answered = _checked(await self._download(_resume_url(answered, candidate)))
        return _resume(answered, candidate)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _api(self, path_or_url: str, *, params: dict[str, str] | None = None) -> Response:
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
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
    ) -> Response:
        try:
            return await self._http.get(
                url, headers={"Accept": "application/json", **(headers or {})}, params=params
            )
        except HTTPError as unreachable:
            raise ManatalUnavailableError(
                f"Manatal did not answer: {type(unreachable).__name__}"
            ) from unreachable


def _checked(answered: Response) -> Response:
    try:
        answered.raise_for_status()
    except HTTPStatusError as refused:
        raise ManatalUnavailableError(
            f"Manatal answered {answered.status_code}: {answered.text[:200]}"
        ) from refused
    return answered


def _resume_url(answered: Response, candidate: ManatalCandidate) -> str:
    named = _record(_json(answered))
    for key in ("url", "resume", "resume_url", "file", "file_url", "download_url"):
        found = _text(named.get(key))
        if _absolute(found):
            return found
    raise ResumeMissingError(f"Manatal named no resume file for {candidate.external_id}")


def _resume(answered: Response, candidate: ManatalCandidate) -> ManatalResume:
    filename = _filename(answered, candidate)
    media_type = _media_type(answered, filename)
    if media_type is None:
        raise ResumeMissingError(f"Unsupported resume format for {candidate.external_id}")
    if not answered.content:
        raise ResumeMissingError(f"Empty resume for {candidate.external_id}")
    return ManatalResume(filename=filename, media_type=media_type, content=answered.content)


def _filename(answered: Response, candidate: ManatalCandidate) -> str:
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


def _candidate(record: dict[str, Any]) -> ManatalCandidate:
    return ManatalCandidate(
        external_id=_first(record, ID_KEYS),
        full_name=_full_name(record),
        email=_email(record),
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
        raw=dict(record),
    )


def _custom(record: dict[str, Any], keys: tuple[str, ...]) -> str:
    custom = record.get("custom_fields")
    return _first(custom, keys) if isinstance(custom, dict) else ""


def _year(stated: str) -> int | None:
    digits = stated.strip()[:4]
    return int(digits) if digits.isdigit() and 1900 <= int(digits) <= 2100 else None


def _first(record: dict[str, Any] | None, keys: tuple[str, ...]) -> str:
    if not isinstance(record, dict):
        return ""
    for key in keys:
        found = _text(record.get(key))
        if found:
            return found
    return ""


def _named_list(record: dict[str, Any], keys: tuple[str, ...]) -> tuple[str, ...]:
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


def _full_name(record: dict[str, Any]) -> str:
    stated = _first(record, NAME_KEYS)
    if stated:
        return stated
    parts = (_text(record.get("first_name")), _text(record.get("last_name")))
    return " ".join(part for part in parts if part)


def _email(record: dict[str, Any]) -> str:
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
        raise ManatalUnavailableError("Manatal answered with non-JSON") from unreadable


def _record(payload: object) -> dict[str, Any]:
    return payload if isinstance(payload, dict) else {}


def _rows(page: dict[str, Any]) -> list[Any]:
    listed = page.get("results") or page.get("data")
    return listed if isinstance(listed, list) else []


def _text(value: object) -> str:
    return str(value).strip() if isinstance(value, str | int) else ""


def _absolute(url: str) -> bool:
    return bool(url) and url.startswith(("http://", "https://"))
