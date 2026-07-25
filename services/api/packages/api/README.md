# sync-api

The HTTP layer: `uvicorn sync_api.main:app`.

- `app.py` — `create_app()` builds a self-contained application, so a test can stand one up
  with its own settings. Routes live under `/v1`.
- `problems.py` / `errors.py` — every error leaves the API as an RFC 9457 problem+json
  document, whether it came from a route, from validation, or from nowhere anyone expected.
  Raise `Problem` to answer with a specific one.
- `middleware.py` — mints a request id (or keeps the caller's `X-Request-Id`), binds it to
  the logs, returns it on the response, and includes it in every problem body.
- `routes/` — one module per resource.
