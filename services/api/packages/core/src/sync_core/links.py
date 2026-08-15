from __future__ import annotations

import re
from typing import Final
from urllib.parse import SplitResult, urlsplit

from sync_core.profile import MAX_LINK_LENGTH

LINKEDIN_HOST: Final = "www.linkedin.com"
GITHUB_HOST: Final = "github.com"

#: What LinkedIn and GitHub let a name be made of. Deliberately narrower than a host name — no
#: dots — so `amina.dev` typed into a handle field reads as the site it is rather than as
#: somebody's LinkedIn.
_HANDLE: Final = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{1,98}[A-Za-z0-9]$")
_HOST: Final = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$")
_LINKEDIN_HOST: Final = re.compile(r"^([a-z0-9-]+\.)?linkedin\.com$")
_GITHUB_HOST: Final = re.compile(r"^(www\.)?github\.com$")
_SCHEME: Final = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")

_LINKEDIN_SHAPE: Final = (
    "a LinkedIn profile address, like linkedin.com/in/amina-haddad, or the handle on its own"
)
_GITHUB_SHAPE: Final = (
    "a GitHub profile address, like github.com/amina-haddad, or the username on its own"
)
_PORTFOLIO_SHAPE: Final = "a web address, like amina-haddad.dev"


def linkedin_address(value: str) -> str:
    """One LinkedIn profile, whole. Raises `ValueError` where the text is not one.

    `linkedin.com/in/amina`, `https://sy.linkedin.com/in/amina?trk=…` and a bare `amina` are one
    person written three ways, and only the first form is worth storing. A company page or a job
    posting is not a person, so neither is accepted here.
    """
    typed = value.strip()
    handle = _handle(typed[3:] if typed[:3].lower() == "in/" else typed)
    if handle is None:
        segments = _segments(typed, _LINKEDIN_HOST, _LINKEDIN_SHAPE)
        if len(segments) != 2 or segments[0].lower() != "in":
            raise ValueError(_LINKEDIN_SHAPE)
        handle = _handle(segments[1])
    if handle is None:
        raise ValueError(_LINKEDIN_SHAPE)
    return _within_length(f"https://{LINKEDIN_HOST}/in/{handle}")


def github_address(value: str) -> str:
    """One GitHub account, whole. Raises `ValueError` where the text is not one.

    A repository address names its owner, so `github.com/amina/dotfiles` answers the same account
    `amina` does: the field holds who somebody is on GitHub, not what they last pushed.
    """
    handle = _handle(value) or _handle(_segments(value, _GITHUB_HOST, _GITHUB_SHAPE)[0])
    if handle is None:
        raise ValueError(_GITHUB_SHAPE)
    return _within_length(f"https://{GITHUB_HOST}/{handle}")


def portfolio_address(value: str) -> str:
    """Somebody's own site, as a browser would open it. Raises `ValueError` where it cannot.

    Anything but `http` and `https` is refused rather than stored: a field rendered as a live link
    is no place for a `javascript:`. A site typed without a scheme gets `https`; one typed with
    `http` keeps it, because rewriting somebody's address is how a working link stops working.
    """
    address = _address(value, _PORTFOLIO_SHAPE)
    host = address.netloc.lower()
    if not _HOST.match(host):
        raise ValueError(_PORTFOLIO_SHAPE)
    query = f"?{address.query}" if address.query else ""
    fragment = f"#{address.fragment}" if address.fragment else ""
    return _within_length(
        f"{address.scheme}://{host}{address.path.rstrip('/')}{query}{fragment}",
    )


def _handle(value: str) -> str | None:
    trimmed = value.strip().lstrip("@")
    return trimmed if _HANDLE.match(trimmed) else None


def _segments(value: str, host: re.Pattern[str], shape: str) -> list[str]:
    """The path of an address on that host, refusing an address anywhere else outright."""
    address = _address(value, shape)
    if not host.match(address.hostname or ""):
        raise ValueError(shape)
    segments = [segment for segment in address.path.split("/") if segment]
    if not segments:
        raise ValueError(shape)
    return segments


def _address(value: str, shape: str) -> SplitResult:
    """The text as a `http`/`https` address. A scheme somebody left off is `https`, and one they
    typed that a browser would not open is the end of it."""
    trimmed = value.strip()
    if not trimmed or any(character.isspace() for character in trimmed):
        raise ValueError(shape)
    address = urlsplit(trimmed if _SCHEME.match(trimmed) else f"https://{trimmed.lstrip('/')}")
    if address.scheme not in ("http", "https") or "@" in address.netloc:
        raise ValueError(shape)
    return address


def _within_length(address: str) -> str:
    if len(address) > MAX_LINK_LENGTH:
        raise ValueError(f"a web address of at most {MAX_LINK_LENGTH} characters")
    return address
