from __future__ import annotations

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from sync_core.db import POOLER_CONNECT_ARGS, pooler_safe_url

DIRECT = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"


def test_prepared_statement_cache_is_disabled() -> None:
    url = pooler_safe_url(DIRECT)
    _, connect_kwargs = create_async_engine(url).dialect.create_connect_args(url)

    assert connect_kwargs["prepared_statement_cache_size"] == 0


def test_existing_query_parameters_survive() -> None:
    url = pooler_safe_url(f"{DIRECT}?ssl=require")

    assert url.query["ssl"] == "require"
    assert url.query["prepared_statement_cache_size"] == "0"


def test_asyncpg_cache_is_off_and_statement_names_are_unique() -> None:
    assert POOLER_CONNECT_ARGS["statement_cache_size"] == 0

    name_func = POOLER_CONNECT_ARGS["prepared_statement_name_func"]
    assert callable(name_func)
    assert name_func() != name_func()


def test_the_setting_is_not_accepted_as_an_engine_argument() -> None:
    """Guards the reason pooler_safe_url exists at all.

    If a future SQLAlchemy accepts this as a keyword, the URL rewriting can go -- and this
    test failing is the signal to check.
    """
    import pytest

    with pytest.raises(TypeError, match="prepared_statement_cache_size"):
        create_async_engine(make_url(DIRECT), prepared_statement_cache_size=0)
