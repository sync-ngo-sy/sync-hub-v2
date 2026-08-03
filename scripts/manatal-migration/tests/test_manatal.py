from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import pytest
from httpx import AsyncClient, MockTransport, Request, Response

from manatal import (
    Candidate,
    CandidateGoneError,
    Manatal,
    ManatalUnavailableError,
    ResumeMissingError,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

BASE_URL = "https://api.manatal.example/open/v3"
TOKEN = "a-manatal-token"
PDF = "application/pdf"

A_CANDIDATE = {
    "id": 42,
    "full_name": "Amina Haddad",
    "email": "amina.haddad@example.com",
    "updated_at": "2026-07-01T09:30:00Z",
    "current_position": "Backend engineer",
}


def answering(answer: Callable[[Request], Response]) -> Manatal:
    return Manatal(
        AsyncClient(transport=MockTransport(answer)),
        base_url=BASE_URL,
        token=TOKEN,
        page_size=2,
    )


def recording(*answers: Response) -> tuple[Manatal, list[Request]]:
    seen: list[Request] = []
    queued: Iterator[Response] = iter(answers)

    def answer(request: Request) -> Response:
        seen.append(request)
        return next(queued)

    return answering(answer), seen


def a_candidate() -> Candidate:
    return Candidate(external_id="42", full_name="Amina Haddad", email="amina@example.com")


async def test_reads_a_candidate() -> None:
    manatal, seen = recording(Response(200, json=A_CANDIDATE))

    found = await manatal.candidate("42")

    assert found.external_id == "42"
    assert found.full_name == "Amina Haddad"
    assert found.email == "amina.haddad@example.com"
    assert found.updated_at == datetime(2026, 7, 1, 9, 30, tzinfo=UTC)
    assert found.headline == "Backend engineer"
    assert seen[0].headers["Authorization"] == f"Token {TOKEN}"


async def test_builds_a_name_and_finds_an_address_in_the_shapes_manatal_uses() -> None:
    manatal, _seen = recording(
        Response(
            200,
            json={
                "id": "7",
                "first_name": "Bashir",
                "last_name": "Nassar",
                "emails": ["bashir@example.com"],
            },
        )
    )

    found = await manatal.candidate("7")

    assert found.full_name == "Bashir Nassar"
    assert found.email == "bashir@example.com"


async def test_a_candidate_manatal_no_longer_has_is_gone_for_good() -> None:
    manatal, _seen = recording(Response(404, json={"detail": "Not found."}))

    with pytest.raises(CandidateGoneError):
        await manatal.candidate("42")


async def test_a_refusal_says_nothing_that_could_be_replayed() -> None:
    manatal, _seen = recording(Response(401, text=f"invalid token: Token {TOKEN}"))

    with pytest.raises(ManatalUnavailableError) as refused:
        await manatal.candidate("42")

    assert TOKEN not in str(refused.value)
    assert "[redacted]" in str(refused.value)


async def test_walks_every_page_of_the_account() -> None:
    manatal, seen = recording(
        Response(
            200,
            json={
                "results": [A_CANDIDATE, {**A_CANDIDATE, "id": 43}],
                "next": f"{BASE_URL}/candidates/?page=2",
            },
        ),
        Response(200, json={"results": [{**A_CANDIDATE, "id": 44}], "next": None}),
    )

    found = await manatal.everyone(limit=10)

    assert [candidate.external_id for candidate in found] == ["42", "43", "44"]
    assert seen[1].url.params["page"] == "2"


async def test_stops_asking_once_it_has_the_limit() -> None:
    manatal, seen = recording(
        Response(
            200,
            json={
                "results": [A_CANDIDATE, {**A_CANDIDATE, "id": 43}],
                "next": f"{BASE_URL}/candidates/?page=2",
            },
        )
    )

    found = await manatal.everyone(limit=2)

    assert len(found) == 2
    assert len(seen) == 1


async def test_downloads_the_resume_without_showing_storage_the_token() -> None:
    downloads = "https://files.manatal.example/resumes/42.pdf?X-Amz-Signature=deadbeef"
    manatal, seen = recording(
        Response(200, json={"url": downloads}),
        Response(200, content=b"%PDF-1.4 resume", headers={"content-type": PDF}),
    )

    resume = await manatal.resume(a_candidate())

    assert resume.content == b"%PDF-1.4 resume"
    assert resume.media_type == PDF
    assert resume.filename == "42.pdf"
    assert "Authorization" not in seen[-1].headers


async def test_takes_the_file_when_the_api_answers_with_one() -> None:
    manatal, _seen = recording(
        Response(
            200,
            content=b"%PDF-1.4 resume",
            headers={
                "content-type": PDF,
                "content-disposition": 'attachment; filename="amina-haddad.pdf"',
            },
        )
    )

    resume = await manatal.resume(a_candidate())

    assert resume.filename == "amina-haddad.pdf"
    assert resume.content == b"%PDF-1.4 resume"


@pytest.mark.parametrize(
    "answer",
    [
        Response(404, json={"detail": "No resume."}),
        Response(200, json={"detail": "nothing here"}),
        Response(200, content=b"", headers={"content-type": PDF}),
    ],
)
async def test_no_readable_resume_is_not_a_failure(answer: Response) -> None:
    manatal, _seen = recording(answer)

    with pytest.raises(ResumeMissingError):
        await manatal.resume(a_candidate())


async def test_a_resume_this_platform_cannot_read_says_so() -> None:
    manatal, _seen = recording(
        Response(200, content=b"plain text cv", headers={"content-type": "text/plain"})
    )

    with pytest.raises(ResumeMissingError) as refused:
        await manatal.resume(a_candidate())

    assert "cannot read" in str(refused.value)
