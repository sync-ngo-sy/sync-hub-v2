# Two images out of one uv workspace: `--target api` and `--target worker`. Each gets only its
# own package's dependencies, so the worker carries no web server and the API no email client.
#
# Build context is `services/api` (the workspace root). From the repo root:
#   docker build -f services/api/Dockerfile --target api services/api

FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /bin/uv

# UV_PYTHON_DOWNLOADS=0: use the system Python in both stages, so the venv copied into the
# runtime image finds the interpreter it was built against.
ENV UV_PYTHON_DOWNLOADS=0 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1

WORKDIR /app


# `--no-install-workspace` keeps third-party dependencies in a layer of their own, so editing our
# code does not re-resolve them. It has to be `--frozen` rather than `--locked`: the member
# `pyproject.toml`s are not in the context yet, so uv cannot check the lockfile against them.
FROM base AS deps-api
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-workspace --no-editable --package sync-api

FROM deps-api AS build-api
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-editable --package sync-api


FROM base AS deps-worker
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-workspace --no-editable --package sync-worker

FROM deps-worker AS build-worker
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-editable --package sync-worker


# The runtime images carry the environment and no source tree: `--no-editable` installed our
# packages into the venv, so `/app/.venv` is the whole application.
FROM python:3.12-slim AS runtime
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
# `app`, not `sync`: Debian already ships a system account called `sync`.
RUN useradd --create-home --uid 10001 app
USER app
WORKDIR /app


FROM runtime AS api
COPY --from=build-api --chown=app:app /app/.venv /app/.venv
EXPOSE 8000
# No `--reload` and no `--workers`: one process per container, scaled by the orchestrator.
CMD ["uvicorn", "sync_api.main:app", "--host", "0.0.0.0", "--port", "8000"]


FROM runtime AS worker
COPY --from=build-worker --chown=app:app /app/.venv /app/.venv
CMD ["sync-worker"]
