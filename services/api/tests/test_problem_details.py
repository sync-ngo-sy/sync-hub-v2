from __future__ import annotations

from httpx import AsyncClient

from sync_api.problems import PROBLEM_JSON_MEDIA_TYPE as PROBLEM_JSON


async def test_unknown_route_is_a_problem(client: AsyncClient) -> None:
    response = await client.get("/v1/does-not-exist")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith(PROBLEM_JSON)
    assert response.json() == {
        "type": "about:blank",
        "title": "Not Found",
        "status": 404,
        "detail": "Not Found",
        "instance": "/v1/does-not-exist",
        "request_id": response.headers["x-request-id"],
    }


async def test_wrong_method_is_a_problem(client: AsyncClient) -> None:
    response = await client.post("/v1/health")

    assert response.status_code == 405
    assert response.headers["content-type"].startswith(PROBLEM_JSON)
    assert response.json()["title"] == "Method Not Allowed"


async def test_validation_failure_is_a_problem_listing_each_error(
    failing_client: AsyncClient,
) -> None:
    response = await failing_client.get("/v1/demo/echo", params={"count": "not-a-number"})

    assert response.status_code == 422
    assert response.headers["content-type"].startswith(PROBLEM_JSON)

    body = response.json()
    assert body["type"] == "urn:sync:problem:validation-error"
    assert body["title"] == "Unprocessable Entity"
    assert body["status"] == 422
    assert body["instance"] == "/v1/demo/echo"

    [error] = body["errors"]
    assert error["location"] == "query.count"
    assert error["message"]


async def test_missing_required_parameter_is_a_problem(failing_client: AsyncClient) -> None:
    response = await failing_client.get("/v1/demo/echo")

    assert response.status_code == 422
    assert [error["location"] for error in response.json()["errors"]] == ["query.count"]


async def test_unhandled_error_is_a_problem_that_says_nothing(
    failing_client: AsyncClient,
) -> None:
    response = await failing_client.get("/v1/demo/boom")

    assert response.status_code == 500
    assert response.headers["content-type"].startswith(PROBLEM_JSON)

    body = response.json()
    assert body["title"] == "Internal Server Error"
    assert body["status"] == 500
    assert "hunter2" not in response.text
    assert body["request_id"] == response.headers["x-request-id"]


async def test_problems_carry_the_request_id_that_correlates_the_logs(
    client: AsyncClient,
) -> None:
    response = await client.get("/v1/nope", headers={"X-Request-Id": "trace-me"})

    assert response.json()["request_id"] == "trace-me"
