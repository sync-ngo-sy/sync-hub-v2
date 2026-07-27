from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from sync_api.dependencies import SessionDep

router = APIRouter(tags=["health"])


class Health(BaseModel):
    """The process is up and serving."""

    status: Literal["ok"] = "ok"


class Readiness(BaseModel):
    """The process is up and its dependencies answer."""

    status: Literal["ok"] = "ok"
    database: Literal["ok"] = "ok"


@router.get("/health", operation_id="getHealth", summary="Liveness check")
async def health() -> Health:
    return Health()


@router.get("/health/ready", operation_id="getReadiness", summary="Readiness check")
async def readiness(session: SessionDep) -> Readiness:
    """Fails as a 500 problem+json if the database is unreachable."""
    await session.execute(text("select 1"))
    return Readiness()
