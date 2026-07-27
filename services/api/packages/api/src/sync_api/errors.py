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
    STORAGE_UNAVAILABLE_PROBLEM_TYPE,
    VALIDATION_PROBLEM_TYPE,
    InvalidField,
    Problem,
    ProblemDetail,
    ValidationProblemDetail,
    title_for,
)
from sync_core import StorageError, get_logger

if TYPE_CHECKING:
    from collections.abc import Sequence

logger = get_logger(__name__)

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
    return [
        InvalidField(
            location=".".join(str(part) for part in error.get("loc", ())),
            message=str(error.get("msg", "")),
            type=str(error.get("type", "")),
        )
        for error in raw_errors
    ]


async def handle_problem(request: Request, exc: Exception) -> JSONResponse:
    # Starlette types every handler as `(Request, Exception)` but dispatches on the class each
    # was registered against, so the narrowing in this module is a fact, not a guess.
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
    return await handle_problem(request, identity_provider_problem(exc))


async def handle_storage_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error("request.storage_unavailable", path=request.url.path, error=str(exc))
    return await handle_problem(
        request,
        Problem(
            status=502,
            type=STORAGE_UNAVAILABLE_PROBLEM_TYPE,
            detail="The file store could not be reached.",
        ),
    )


def install_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(Problem, handle_problem)
    app.add_exception_handler(GoTrueUnavailableError, handle_identity_provider_error)
    app.add_exception_handler(StorageError, handle_storage_error)
    app.add_exception_handler(HTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(Exception, handle_unexpected_error)


def use_problem_media_type(schema: dict[str, Any]) -> dict[str, Any]:
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
    return {
        "model": model,
        "description": description,
        "content": {PROBLEM_JSON_MEDIA_TYPE: {}},
    }


PROBLEM_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: openapi_problem("The request did not match the expected shape.", ValidationProblemDetail),
    500: openapi_problem("Something went wrong on the server."),
}
