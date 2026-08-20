"""Waiting out a rate limit rather than turning it into 5,000 failed candidates.

#121 set the fan-out to 1 because Manatal's limits are not documented well enough to fan out. The
fan-out is 4 for the wall-clock, so waiting is what has to make that safe: without it a burst of
429s becomes a pile of failures, and a failure is a chance to leave something half done.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

import pytest
from httpx import AsyncClient, MockTransport, Response

from manatal import LONGEST_PAUSE, RATE_LIMIT_ATTEMPTS, Manatal, ManatalUnavailableError

if TYPE_CHECKING:
    from httpx import Request

BASE_URL: Final = "https://api.manatal.example/open/v3"
ONE_CANDIDATE: Final = {"results": [{"id": 1, "full_name": "Amal", "email": "a@b.c"}]}


def throttled(times: int, *, retry_after: str | None = None) -> tuple[Manatal, list[float]]:
    """A Manatal that answers 429 this many times, then succeeds. Records what it waited."""
    answers = iter(
        [
            Response(
                429, headers={"retry-after": retry_after} if retry_after else {}, json={"d": "slow"}
            )
        ]
        * times
        + [Response(200, json=ONE_CANDIDATE)] * (RATE_LIMIT_ATTEMPTS + 1)
    )
    waited: list[float] = []

    async def sleeping(seconds: float) -> None:
        waited.append(seconds)

    def answering(_request: Request) -> Response:
        return next(answers)

    client = AsyncClient(transport=MockTransport(answering), base_url=BASE_URL)
    return (
        Manatal(client, base_url=BASE_URL, token="t", page_size=50, sleep=sleeping),
        waited,
    )


async def test_a_single_rate_limit_is_waited_out_not_failed() -> None:
    manatal, waited = throttled(1)

    everyone = await manatal.everyone(limit=1)

    assert [person.full_name for person in everyone] == ["Amal"]
    assert len(waited) == 1


async def test_the_wait_manatal_asks_for_is_the_one_taken() -> None:
    manatal, waited = throttled(1, retry_after="7")

    await manatal.everyone(limit=1)

    assert waited == [7.0]


async def test_an_unreasonable_retry_after_is_capped() -> None:
    """A server may name a very large number, and a migration cannot stall for an afternoon."""
    manatal, waited = throttled(1, retry_after="86400")

    await manatal.everyone(limit=1)

    assert waited == [LONGEST_PAUSE]


async def test_a_retry_after_that_is_not_a_number_falls_back_to_backing_off() -> None:
    manatal, waited = throttled(1, retry_after="Wed, 21 Oct 2026 07:28:00 GMT")

    await manatal.everyone(limit=1)

    assert waited and waited[0] > 0


async def test_the_pause_doubles_while_it_keeps_being_refused() -> None:
    manatal, waited = throttled(3)

    await manatal.everyone(limit=1)

    assert waited == sorted(waited)
    assert len(set(waited)) > 1


async def test_an_account_that_never_relents_fails_rather_than_hanging() -> None:
    manatal, waited = throttled(RATE_LIMIT_ATTEMPTS + 5)

    with pytest.raises(ManatalUnavailableError) as refused:
        await manatal.everyone(limit=1)

    assert "429" in str(refused.value)
    assert len(waited) == RATE_LIMIT_ATTEMPTS - 1
