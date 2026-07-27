"""Receiving a CV file from the browser.

Everything between "a multipart request arrived" and "here is a file, its type and its
hash". The hash is the reason this is a step of its own: it is computed here, from the
bytes as they arrive, and never taken from the client — a candidate who could name their
own `file_hash` could claim any other upload's identity, or evade the duplicate check by
inventing a new one.

The file lands on disk rather than in memory, and is handed on as an open reader, so a
10 MB upload costs a temporary file rather than 10 MB of the process — and Storage streams
from that reader rather than being handed a buffer.
"""

from __future__ import annotations

import hashlib
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final

from anyio import to_thread

from sync_api.problems import (
    CV_EMPTY_PROBLEM_TYPE,
    CV_MEDIA_TYPE_PROBLEM_TYPE,
    CV_TOO_LARGE_PROBLEM_TYPE,
    Problem,
)
from sync_core.profile import MAX_LINE_LENGTH
from sync_core.storage import CV_MEDIA_TYPE_BY_EXTENSION, CV_MEDIA_TYPES

if TYPE_CHECKING:
    from collections.abc import AsyncIterator
    from io import BufferedReader

    from fastapi import UploadFile

READ_CHUNK_BYTES: Final = 1024 * 1024


@dataclass(frozen=True, slots=True)
class ReceivedFile:
    """An uploaded CV, on disk, with everything the `cvs` row needs to describe it."""

    reader: BufferedReader
    display_name: str
    media_type: str
    extension: str
    sha256: str
    size: int


@asynccontextmanager
async def received(upload: UploadFile, *, max_bytes: int) -> AsyncIterator[ReceivedFile]:
    """One uploaded CV, for the length of the `with` block and no longer.

    The temporary file is deleted on the way out however the block ends, so a refused
    insert, a Storage failure or an unhandled error all leave the same nothing behind.
    """
    media_type = _media_type_of(upload)
    with tempfile.TemporaryDirectory(prefix="sync-cv-") as directory:
        spooled = Path(directory) / "upload"
        digest, size = await _spool(upload, spooled, max_bytes=max_bytes)
        with spooled.open("rb") as reader:
            yield ReceivedFile(
                reader=reader,
                display_name=_display_name(upload),
                media_type=media_type,
                extension=CV_MEDIA_TYPES[media_type],
                sha256=digest,
                size=size,
            )


async def _spool(upload: UploadFile, destination: Path, *, max_bytes: int) -> tuple[str, int]:
    """Write the upload to `destination`, hashing it on the way, refusing an oversized one.

    The size is checked per chunk rather than from `upload.size`, which is a header the
    client wrote — the point of the ceiling is the bytes it stops us from accepting.
    """
    digest = hashlib.sha256()
    size = 0
    with destination.open("wb") as sink:
        while chunk := await upload.read(READ_CHUNK_BYTES):
            size += len(chunk)
            if size > max_bytes:
                raise _too_large(max_bytes)
            digest.update(chunk)
            await to_thread.run_sync(sink.write, chunk)
    if size == 0:
        raise Problem(
            status=422,
            type=CV_EMPTY_PROBLEM_TYPE,
            detail="The uploaded file is empty.",
        )
    return digest.hexdigest(), size


def _media_type_of(upload: UploadFile) -> str:
    declared = (upload.content_type or "").split(";")[0].strip().lower()
    if declared in CV_MEDIA_TYPES:
        return declared
    # The extension is a weaker claim than the declared type, so it is consulted second
    # and only for the browsers that send `application/octet-stream` for a `.doc` rather
    # than admitting they do not know.
    guessed = CV_MEDIA_TYPE_BY_EXTENSION.get(Path(upload.filename or "").suffix.lower())
    if guessed is not None:
        return guessed
    raise Problem(
        status=415,
        type=CV_MEDIA_TYPE_PROBLEM_TYPE,
        detail="A CV has to be a PDF, DOC or DOCX file.",
    )


def _display_name(upload: UploadFile) -> str:
    """What to call this CV in the candidate's list.

    A label, never a path: the stored object's name is built from the CV's id, so nothing
    a candidate types here reaches the filesystem or Storage.
    """
    name = Path(upload.filename or "").name.strip()
    return name[:MAX_LINE_LENGTH] if name else "CV"


def _too_large(max_bytes: int) -> Problem:
    return Problem(
        status=413,
        type=CV_TOO_LARGE_PROBLEM_TYPE,
        detail=f"A CV has to be {max_bytes // (1024 * 1024)} MB or smaller.",
    )
