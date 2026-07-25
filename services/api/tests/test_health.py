"""The walking skeleton's proof of life: HTTP in, database out."""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_responds_ok(client: AsyncClient) -> None:
    response = await client.get("/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_reaches_the_database(client: AsyncClient) -> None:
    response = await client.get("/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_health_is_json_not_problem_json(client: AsyncClient) -> None:
    response = await client.get("/v1/health")

    assert response.headers["content-type"].startswith("application/json")
