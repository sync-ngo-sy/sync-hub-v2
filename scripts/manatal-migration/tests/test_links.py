from links import linkedin_address


def test_a_linkedin_handle_becomes_the_whole_address() -> None:
    assert linkedin_address("amina-haddad") == "https://www.linkedin.com/in/amina-haddad"


def test_a_full_linkedin_address_is_normalised() -> None:
    assert (
        linkedin_address("https://sy.linkedin.com/in/amina-haddad?trk=public")
        == "https://www.linkedin.com/in/amina-haddad"
    )


def test_what_is_not_a_linkedin_profile_is_refused() -> None:
    assert linkedin_address("https://www.linkedin.com/company/acme") is None
