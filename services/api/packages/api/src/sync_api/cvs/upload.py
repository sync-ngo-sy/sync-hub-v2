from __future__ import annotations

import hashlib
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from anyio import to_thread

from sync_api.problems import (
    CV_EMPTY_PROBLEM_TYPE,
    CV_MEDIA_TYPE_PROBLEM_TYPE,
    CV_TOO_LARGE_PROBLEM_TYPE,
    INVALID_CV_FILENAME_PROBLEM_TYPE,
    Problem,
)
from sync_api.uploads import limited_chunks
from sync_core.profile import CONTROL_CHARACTERS, MAX_LINE_LENGTH
from sync_core.storage import CV_MEDIA_TYPE_BY_EXTENSION, CV_MEDIA_TYPES

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator
    from io import BufferedReader

    from fastapi import UploadFile


@dataclass(frozen=True, slots=True)
class ReceivedFile:
    reader: BufferedReader
    display_name: str
    media_type: str
    sha256: str
    size: int


@asynccontextmanager
async def received(upload: UploadFile, *, max_bytes: int) -> AsyncGenerator[ReceivedFile]:
    media_type = _media_type_of(upload)
    with tempfile.TemporaryDirectory(prefix="sync-cv-") as directory:
        spooled = Path(directory) / "upload"
        digest, size = await _spool(upload, spooled, max_bytes=max_bytes)
        with spooled.open("rb") as reader:
            yield ReceivedFile(
                reader=reader,
                display_name=_display_name(upload),
                media_type=media_type,
                sha256=digest,
                size=size,
            )


async def _spool(upload: UploadFile, destination: Path, *, max_bytes: int) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with destination.open("wb") as sink:
        async for chunk in limited_chunks(
            upload,
            max_bytes=max_bytes,
            too_large=_too_large(max_bytes),
            empty=Problem(
                status=422,
                type=CV_EMPTY_PROBLEM_TYPE,
                detail="The uploaded file is empty.",
            ),
        ):
            size += len(chunk)
            digest.update(chunk)
            await to_thread.run_sync(sink.write, chunk)
    return digest.hexdigest(), size


def _media_type_of(upload: UploadFile) -> str:
    declared = (upload.content_type or "").split(";")[0].strip().lower()
    if declared in CV_MEDIA_TYPES:
        return declared
    guessed = CV_MEDIA_TYPE_BY_EXTENSION.get(Path(upload.filename or "").suffix.lower())
    if guessed is not None:
        return guessed
    raise Problem(
        status=415,
        type=CV_MEDIA_TYPE_PROBLEM_TYPE,
        detail="A CV has to be a PDF, DOC or DOCX file.",
    )


def _display_name(upload: UploadFile) -> str:
    name = Path(upload.filename or "").name.strip()
    if CONTROL_CHARACTERS.search(name):
        raise Problem(
            status=422,
            type=INVALID_CV_FILENAME_PROBLEM_TYPE,
            detail="A CV filename cannot contain control characters.",
        )
    return name[:MAX_LINE_LENGTH] if name else "CV"


def _too_large(max_bytes: int) -> Problem:
    return Problem(
        status=413,
        type=CV_TOO_LARGE_PROBLEM_TYPE,
        detail=f"A CV has to be {max_bytes // (1024 * 1024)} MB or smaller.",
    )
