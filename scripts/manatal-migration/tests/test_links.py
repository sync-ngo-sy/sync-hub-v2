import pytest

from links import github_address, linkedin_address, portfolio_address


def test_a_linkedin_handle_becomes_the_whole_address() -> None:
    assert linkedin_address("amina-haddad") == "https://www.linkedin.com/in/amina-haddad"


def test_a_full_linkedin_address_is_normalised() -> None:
    assert (
        linkedin_address("https://sy.linkedin.com/in/amina-haddad?trk=public")
        == "https://www.linkedin.com/in/amina-haddad"
    )


def test_what_is_not_a_linkedin_profile_is_refused() -> None:
    assert linkedin_address("https://www.linkedin.com/company/acme") is None


@pytest.mark.parametrize(
    "typed",
    [
        "https://github.com/amina-haddad",
        "github.com/amina-haddad",
        "https://www.github.com/amina-haddad/",
        "amina-haddad",
        "https://github.com/amina-haddad/some-project",
    ],
)
def test_a_github_account_however_it_was_written(typed: str) -> None:
    assert github_address(typed) == "https://github.com/amina-haddad"


@pytest.mark.parametrize("typed", ["", "   ", "not a url", "https://example.com/amina"])
def test_what_is_not_a_github_account_is_none(typed: str) -> None:
    assert github_address(typed) is None


def test_a_portfolio_is_any_other_web_address() -> None:
    assert portfolio_address("https://amina.dev") == "https://amina.dev"
    assert portfolio_address("amina.dev/work") == "https://amina.dev/work"


@pytest.mark.parametrize(
    "typed",
    ["https://www.linkedin.com/in/amina", "https://github.com/amina", "", "not a url", "localhost"],
)
def test_a_link_with_a_column_of_its_own_is_not_a_portfolio(typed: str) -> None:
    """Storing it twice would have the same link disagree with itself later."""
    assert portfolio_address(typed) is None
