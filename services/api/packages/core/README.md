# sync-core

What every backend process needs before it can do anything: configuration, the database
connection, the generated SQLAlchemy models, and structured logging.

- `settings.py` — the whole process configuration, read from `SYNC_`-prefixed environment
  variables. Nothing has a secret for a default.
- `db.py` — one async engine over asyncpg (ADR-0004), handing out sessions and
  transactions. The backend is the only data client; this is the whole data path.
- `models.py` — **generated** from the migrated schema by `scripts/generate_models.py`.
  Never edit it; change a migration and regenerate. Relationships are `viewonly` — write by
  assigning foreign key columns.
- `logging.py` — one structlog-rendered handler for our events and for everything uvicorn
  and SQLAlchemy emit, with per-request context bound in a contextvar.
