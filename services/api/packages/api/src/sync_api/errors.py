"""Turning every way a request can fail into one problem+json response.

Four handlers cover the whole surface: `Problem` for errors a route raises deliberately,
`GoTrueUnavailableError` for an identity provider that is down (one 502, so no flow has to
remember to translate it), `HTTPException` for everything Starlette raises on our behalf
(unknown route, wrong method, dependency failures), and `Exception` for the ones nobody
saw coming.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from sync_api.auth.gotrue import GoTrueUnavailableError
from sync_api.auth.service import identity_provider_problem
from sync_api.middleware import REQUEST_ID_HEADER, request_id
from sync_api.problems import (
    PROBLEM_JSON_MEDIA_TYPE,
    VALIDATION_PROBLEM_TYPE,
    InvalidField,
    Problem,
    ProblemDetail,
    ValidationProblemDetail,
    title_for,
)
from sync_core import get_logger

if TYPE_CHECKING:
    from collections.abc import Sequence

logger = get_logger(__name__)

#: What an unhandled error is allowed to say. The real cause goes to the logs, under the
#: request id the client is holding.
INTERNAL_ERROR_DETAIL = "The server could not complete the request."


def problem_response(
    request: Request, problem: ProblemDetail, headers: dict[str, str]
) -> JSONResponse:
    problem.request_id = request_id()
    return JSONResponse(
        status_code=problem.status,
        content=problem.model_dump(mode="json"),
        media_type=PROBLEM_JSON_MEDIA_TYPE,
        headers=headers,
    )


def field_errors(raw_errors: Sequence[Any]) -> list[InvalidField]:
    """Flatten pydantic's error list into locations a client can point a user at."""
    return [
        InvalidField(
            location=".".join(str(part) for part in error.get("loc", ())),
            message=str(error.get("msg", "")),
            type=str(error.get("type", "")),
        )
        for error in raw_errors
    ]


# Starlette types every handler as `(Request, Exception)` but dispatches on the class each
# was registered against, so the narrowing below is a fact, not a guess.
async def handle_problem(request: Request, exc: Exception) -> JSONResponse:
    problem = cast("Problem", exc)
    detail = ProblemDetail(
        type=problem.type,
        title=problem.title,
        status=problem.status,
        detail=problem.detail,
        instance=request.url.path,
        **problem.extensions,
    )
    return problem_response(request, detail, problem.headers)


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    """Starlette's own failures — 404, 405, and anything a dependency raises."""
    http_exc = cast("HTTPException", exc)
    detail = ProblemDetail(
        title=title_for(http_exc.status_code),
        status=http_exc.status_code,
        detail=str(http_exc.detail) if http_exc.detail else None,
        instance=request.url.path,
    )
    return problem_response(request, detail, dict(http_exc.headers or {}))


async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    validation_exc = cast("RequestValidationError", exc)
    detail = ValidationProblemDetail(
        type=VALIDATION_PROBLEM_TYPE,
        title=title_for(422),
        status=422,
        detail="The request did not match the expected shape.",
        instance=request.url.path,
        errors=field_errors(validation_exc.errors()),
    )
    return problem_response(request, detail, {})


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """The last resort. Says nothing about `exc` — the logs hold the detail.

    The only handler that has to put the request id on the wire itself: Starlette wires
    `Exception` to `ServerErrorMiddleware`, which sits *outside* every middleware we add, so
    this response never passes the correlation middleware that echoes the header for
    everything else.
    """
    logger.exception(
        "request.unhandled_error",
        path=request.url.path,
        method=request.method,
        exc_info=exc,
    )
    detail = ProblemDetail(
        title=title_for(500),
        status=500,
        detail=INTERNAL_ERROR_DETAIL,
        instance=request.url.path,
    )
    correlation = request_id()
    return problem_response(
        request, detail, {REQUEST_ID_HEADER: correlation} if correlation else {}
    )


async def handle_identity_provider_error(request: Request, exc: Exception) -> JSONResponse:
    """GoTrue was unreachable or answered something we cannot act on — one 502 for all of it."""
    return await handle_problem(request, identity_provider_problem(exc))


def install_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(Problem, handle_problem)
    app.add_exception_handler(GoTrueUnavailableError, handle_identity_provider_error)
    app.add_exception_handler(HTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(Exception, handle_unexpected_error)


def use_problem_media_type(schema: dict[str, Any]) -> dict[str, Any]:
    """Re-label every error response in an OpenAPI document as problem+json.

    FastAPI files a response `model` under the route's own media type, which is always
    `application/json`. Error bodies only ever leave as problem+json, so without this the
    document — and the TypeScript client generated from it — promises a content type the
    API never sends. Idempotent.
    """
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            for status_code, response in operation.get("responses", {}).items():
                if not str(status_code).isdigit() or int(status_code) < 400:
                    continue
                content = response.get("content")
                if not content or PROBLEM_JSON_MEDIA_TYPE not in content:
                    continue
                moved = content.pop("application/json", None)
                if moved:
                    content[PROBLEM_JSON_MEDIA_TYPE] = moved
    return schema


def openapi_problem(description: str, model: type[ProblemDetail] = ProblemDetail) -> dict[str, Any]:
    """One entry for a route's `responses`, so a failure it can answer with is in the schema.

    The `content` key is what `use_problem_media_type` keys off; without it FastAPI would
    file the body under `application/json` and the generated client would expect the wrong
    media type.
    """
    return {
        "model": model,
        "description": description,
        "content": {PROBLEM_JSON_MEDIA_TYPE: {}},
    }


#: Advertised on every route, so the generated client knows errors are problem+json.
PROBLEM_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: openapi_problem("The request did not match the expected shape.", ValidationProblemDetail),
    500: openapi_problem("Something went wrong on the server."),
}
