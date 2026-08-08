from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any, Final

from sync_core import StorageError, get_logger

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, AsyncIterator

    from fastapi import UploadFile

    from sync_api.problems import Problem
    from sync_core import Storage

logger = get_logger(__name__)

READ_CHUNK_BYTES: Final = 256 * 1024


async def limited_chunks(
    upload: UploadFile,
    *,
    max_bytes: int,
    too_large: Problem,
    empty: Problem,
) -> AsyncGenerator[bytes]:
    size = 0
    while chunk := await upload.read(READ_CHUNK_BYTES):
        size += len(chunk)
        if size > max_bytes:
            raise too_large
        yield chunk
    if size == 0:
        raise empty


@asynccontextmanager
async def discard_on_failure(
    storage: Storage, path: str, *, event: str, **context: Any
) -> AsyncIterator[None]:
    try:
        yield
    except BaseException:
        await remove_uploaded(storage, path, event=event, **context)
        raise


async def remove_uploaded(storage: Storage, path: str, *, event: str, **context: Any) -> None:
    try:
        await storage.remove(path)
    except StorageError as error:
        logger.error(event, object_path=path, error=str(error), **context)
