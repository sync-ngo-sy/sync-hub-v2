"""Normalising professional links into the shape the platform stores.

Copied from the platform's own rules rather than imported: this script stays standalone, and
pulling in `sync_core` would tie a one-off to a codebase that keeps moving.
"""

from __future__ import annotations

import re
from typing import Final
from urllib.parse import urlsplit

LINKEDIN_HOST: Final = "www.linkedin.com"
GITHUB_HOST: Final = "github.com"
_HANDLE: Final = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{1,98}[A-Za-z0-9]$")
_LINKEDIN_HOST: Final = re.compile(r"^([a-z0-9-]+\.)?linkedin\.com$")
_GITHUB_HOST: Final = re.compile(r"^([a-z0-9-]+\.)?github\.com$")
_SCHEME: Final = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")
MAX_LENGTH: Final = 2000

#: A portfolio is any web address, so it is the one link that has to be excluded rather than
#: matched: the two that have columns of their own belong in them.
_HAS_A_COLUMN: Final = (_LINKEDIN_HOST, _GITHUB_HOST)


def linkedin_address(value: str) -> str | None:
    """One LinkedIn profile, whole. Returns None where the text is not one."""
    typed = value.strip()
    if not typed:
        return None
    try:
        handle = _handle(typed[3:] if typed[:3].lower() == "in/" else typed)
        if handle is None:
            segments = _segments(typed)
            if len(segments) != 2 or segments[0].lower() != "in":
                return None
            handle = _handle(segments[1])
        if handle is None:
            return None
        return _within_length(f"https://{LINKEDIN_HOST}/in/{handle}")
    except ValueError:
        return None


def github_address(value: str) -> str | None:
    """One GitHub account, whole. `candidates_github_url_shape` accepts nothing else."""
    typed = value.strip()
    if not typed:
        return None
    try:
        handle = _handle(typed)
        if handle is None:
            segments = _segments_of(typed, _GITHUB_HOST)
            # A repository address names the account first, which is the part we store.
            handle = _handle(segments[0]) if segments else None
        if handle is None:
            return None
        return _within_length(f"https://{GITHUB_HOST}/{handle}")
    except ValueError:
        return None


def portfolio_address(value: str) -> str | None:
    """Any web address that is not one of the two with a column of its own."""
    typed = value.strip()
    if not typed:
        return None
    try:
        address = _address(typed)
    except ValueError:
        return None
    host = address.hostname or ""
    if not host or "." not in host or any(known.match(host) for known in _HAS_A_COLUMN):
        return None
    try:
        return _within_length(address.geturl())
    except ValueError:
        return None


def _handle(value: str) -> str | None:
    trimmed = value.strip().lstrip("@")
    return trimmed if _HANDLE.match(trimmed) else None


def _segments(value: str) -> list[str]:
    return _segments_of(value, _LINKEDIN_HOST)


def _segments_of(value: str, host: re.Pattern[str]) -> list[str]:
    address = _address(value)
    if not host.match(address.hostname or ""):
        raise ValueError("not the expected host")
    segments = [segment for segment in address.path.split("/") if segment]
    if not segments:
        raise ValueError("no account in the address")
    return segments


def _address(value: str):
    trimmed = value.strip()
    if not trimmed or any(character.isspace() for character in trimmed):
        raise ValueError("empty")
    address = urlsplit(trimmed if _SCHEME.match(trimmed) else f"https://{trimmed.lstrip('/')}")
    if address.scheme not in ("http", "https") or "@" in address.netloc:
        raise ValueError("not a web address")
    return address


def _within_length(address: str) -> str:
    if len(address) > MAX_LENGTH:
        raise ValueError("too long")
    return address
