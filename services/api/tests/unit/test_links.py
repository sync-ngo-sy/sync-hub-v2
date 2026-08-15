from __future__ import annotations

import pytest

from sync_core.links import github_address, linkedin_address, portfolio_address
from sync_core.profile import MAX_LINK_LENGTH


@pytest.mark.parametrize(
    "typed",
    [
        "https://www.linkedin.com/in/amina-haddad",
        "http://www.linkedin.com/in/amina-haddad",
        "https://linkedin.com/in/amina-haddad/",
        "https://sy.linkedin.com/in/amina-haddad",
        "www.linkedin.com/in/amina-haddad",
        "linkedin.com/in/amina-haddad",
        "  linkedin.com/in/amina-haddad  ",
    ],
)
def test_every_way_of_writing_one_linkedin_profile_is_the_same_address(typed: str) -> None:
    assert linkedin_address(typed) == "https://www.linkedin.com/in/amina-haddad"


@pytest.mark.parametrize("typed", ["amina-haddad", "@amina-haddad", "in/amina-haddad"])
def test_a_linkedin_handle_on_its_own_becomes_the_whole_address(typed: str) -> None:
    assert linkedin_address(typed) == "https://www.linkedin.com/in/amina-haddad"


def test_a_linkedin_address_keeps_nothing_of_where_it_was_copied_from() -> None:
    tracked = "https://www.linkedin.com/in/amina-haddad?trk=public_profile#about"

    assert linkedin_address(tracked) == "https://www.linkedin.com/in/amina-haddad"


@pytest.mark.parametrize(
    "typed",
    [
        "https://www.linkedin.com/company/aman-relief",
        "https://www.linkedin.com/in/amina/details/experience",
        "https://www.linkedin.com",
        "https://github.com/amina-haddad",
        "amina-haddad.dev",
        "amina haddad",
        "",
    ],
)
def test_what_is_not_a_linkedin_profile_is_refused(typed: str) -> None:
    with pytest.raises(ValueError, match="LinkedIn"):
        linkedin_address(typed)


@pytest.mark.parametrize(
    "typed",
    [
        "https://github.com/amina-haddad",
        "https://www.github.com/amina-haddad",
        "github.com/amina-haddad/",
        "amina-haddad",
        "@amina-haddad",
    ],
)
def test_every_way_of_writing_one_github_account_is_the_same_address(typed: str) -> None:
    assert github_address(typed) == "https://github.com/amina-haddad"


def test_a_repository_is_stored_as_the_account_that_owns_it() -> None:
    assert github_address("https://github.com/amina-haddad/ledger") == (
        "https://github.com/amina-haddad"
    )


@pytest.mark.parametrize(
    "typed", ["https://gitlab.com/amina-haddad", "https://github.com", "amina-haddad.dev", ""]
)
def test_what_is_not_a_github_account_is_refused(typed: str) -> None:
    with pytest.raises(ValueError, match="GitHub"):
        github_address(typed)


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("amina-haddad.dev", "https://amina-haddad.dev"),
        ("https://amina-haddad.dev/", "https://amina-haddad.dev"),
        ("HTTPS://Amina-Haddad.DEV/Work", "https://amina-haddad.dev/Work"),
        ("http://amina-haddad.dev", "http://amina-haddad.dev"),
        ("https://amina-haddad.dev/work?year=2026", "https://amina-haddad.dev/work?year=2026"),
        ("https://amina-haddad.dev//", "https://amina-haddad.dev"),
    ],
)
def test_a_portfolio_is_stored_as_a_browser_would_open_it(typed: str, stored: str) -> None:
    assert portfolio_address(typed) == stored


@pytest.mark.parametrize(
    "typed", ["https://amina@amina-haddad.dev", "https://amina:secret@amina-haddad.dev"]
)
def test_an_address_carrying_somebody_elses_credentials_is_not_a_portfolio(typed: str) -> None:
    with pytest.raises(ValueError, match="web address"):
        portfolio_address(typed)


def test_credentials_are_refused_on_every_kind_of_link_alike() -> None:
    """A stored address is rendered as a live link, so the one that opens it has to be the one
    that was typed — not the one left after a normalizer quietly dropped a `user@` from it."""
    with pytest.raises(ValueError, match="LinkedIn"):
        linkedin_address("https://evil@www.linkedin.com/in/amina-haddad")
    with pytest.raises(ValueError, match="GitHub"):
        github_address("https://evil:secret@github.com/amina-haddad")


@pytest.mark.parametrize(
    "typed",
    [
        "javascript:alert(1)",
        "mailto:amina@example.com",
        "ftp://files.example.com",
        "amina-haddad",
        "amina haddad.dev",
        "",
    ],
)
def test_what_a_browser_could_not_open_is_not_a_portfolio(typed: str) -> None:
    with pytest.raises(ValueError, match="web address"):
        portfolio_address(typed)


def test_an_address_longer_than_the_column_is_refused_rather_than_stored() -> None:
    with pytest.raises(ValueError, match=str(MAX_LINK_LENGTH)):
        portfolio_address(f"https://amina-haddad.dev/{'x' * MAX_LINK_LENGTH}")
