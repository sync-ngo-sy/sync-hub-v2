from __future__ import annotations

import pytest

from preflight import Check, manatal_check, passed, phone_region_check, summary, supabase_check


class Refuses:
    """A client that fails the way an expired key fails."""

    async def everyone(self, *, limit: int) -> list[str]:
        raise RuntimeError("401 Unauthorized")

    async def read_cv(self, path: str) -> bytes | None:
        raise RuntimeError("401 Unauthorized")


class Answers:
    async def everyone(self, *, limit: int) -> list[str]:
        return ["one record"]

    async def read_cv(self, path: str) -> bytes | None:
        return None


def test_a_failed_check_says_what_to_do_about_it() -> None:
    """The operator reading this did not write the script and cannot read the traceback."""
    check = phone_region_check("syria")

    assert not check.passed
    assert "two capital letters" in check.detail
    assert "MANATAL_PHONE_REGION" in check.fix


def test_a_real_country_code_passes() -> None:
    assert phone_region_check("SY").passed


async def test_a_key_that_does_not_work_is_reported_as_the_key() -> None:
    check = await manatal_check(Refuses())  # type: ignore[arg-type]

    assert not check.passed
    assert "MANATAL_API_TOKEN" in check.fix


async def test_a_working_key_passes() -> None:
    assert (await manatal_check(Answers())).passed  # type: ignore[arg-type]


async def test_a_check_that_does_not_apply_to_this_run_passes() -> None:
    """`--inventory` never touches the platform, so it is not asked for its credentials."""
    check = await supabase_check(None)

    assert check.passed
    assert "not needed" in check.detail


async def test_the_service_key_failing_names_the_service_key() -> None:
    check = await supabase_check(Refuses())  # type: ignore[arg-type]

    assert not check.passed
    assert "SYNC_SUPABASE_SERVICE_ROLE_KEY" in check.fix


def test_the_summary_says_nothing_was_changed() -> None:
    """Somebody who sees STOP needs to know the migration did not half-run."""
    said = summary([Check("fine?", True), Check("broken?", False)])

    assert "Nothing has been changed" in said
    assert "1 of 2" in said


def test_the_summary_of_a_clean_run_says_it_can_go_ahead() -> None:
    checks = [Check("fine?", True), Check("also fine?", True)]

    assert passed(checks)
    assert "can run" in summary(checks)


@pytest.mark.parametrize("ok", [True, False])
def test_every_line_names_its_state_first(ok: bool) -> None:
    line = Check("ready?", ok, "some detail").line

    assert line.strip().startswith("OK" if ok else "STOP")
    assert "ready?" in line


async def test_check_reports_a_key_it_was_never_given_rather_than_asking_for_one() -> None:
    """`--check` reports. A prompt here would hang a run that has nobody at the keyboard."""
    check = await manatal_check(None, needed=True)

    assert not check.passed
    assert "cannot be tried" in check.detail
    assert "MANATAL_API_TOKEN" in check.fix
