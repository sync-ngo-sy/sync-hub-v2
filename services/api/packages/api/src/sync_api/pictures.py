from __future__ import annotations

import io
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import uuid4

from anyio import to_thread
from PIL import Image, ImageOps, UnidentifiedImageError
from PIL.Image import DecompressionBombError

from sync_api.problems import Problem
from sync_api.uploads import discard_on_failure, limited_chunks, remove_uploaded
from sync_core import get_logger

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from fastapi import UploadFile

    from sync_core import Storage

logger = get_logger(__name__)

SQUARE_PIXELS: Final = 512

SQUARE_QUALITY: Final = 80

SQUARE_MEDIA_TYPE: Final = "image/webp"

#: Longest side the platform will decode. A decode holds three bytes for every pixel and
#: the convert after it four more, so the source is what bounds one upload's memory.
LARGEST_SOURCE_SIDE: Final = 4096

READABLE_FORMATS: Final = frozenset({"JPEG", "PNG", "WEBP"})

ACCEPTED_FORMATS: Final = "JPEG, PNG or WebP"

TRANSPARENT_MODES: Final = frozenset({"RGBA", "LA", "PA", "P"})

#: Told the address the new object answers on, and gives back the address it replaced.
type Remember = Callable[[str], Awaitable[str | None]]


@dataclass(frozen=True, slots=True)
class PictureKind:
    """One kind of square picture the platform keeps, and everything that differs between them.

    A profile photo and a Tenant logo are the same picture as far as storing one goes. They
    differ in what a refusal has to call the file somebody picked, and in the namespace every
    log line about one is written under.
    """

    events: str
    subject: str
    unreadable_type: str
    too_large_type: str
    too_many_pixels_type: str
    empty_type: str

    def unreadable(self) -> Problem:
        return Problem(
            status=415,
            type=self.unreadable_type,
            detail=f"{self.subject} has to be a {ACCEPTED_FORMATS} image.",
        )

    def too_large(self, max_bytes: int) -> Problem:
        return Problem(
            status=413,
            type=self.too_large_type,
            detail=f"{self.subject} has to be {max_bytes // (1024 * 1024)} MB or smaller. "
            f"Crop it or pick a smaller {ACCEPTED_FORMATS} file.",
        )

    def too_many_pixels(self) -> Problem:
        return Problem(
            status=413,
            type=self.too_many_pixels_type,
            detail=f"{self.subject} has to be {LARGEST_SOURCE_SIDE} pixels or smaller on each "
            f"side. Crop it or pick a smaller {ACCEPTED_FORMATS} file.",
        )

    def empty(self) -> Problem:
        return Problem(
            status=422,
            type=self.empty_type,
            detail="The file you picked is empty.",
        )


async def replace_picture(
    storage: Storage,
    upload: UploadFile,
    *,
    kind: PictureKind,
    folder: str,
    max_bytes: int,
    remember: Remember,
    logged_as: dict[str, str],
) -> str:
    """Store what somebody uploaded and answer with the address it now answers on.

    The new object is written and remembered before the one it replaces is dropped, so a step
    that fails leaves an object nobody points at rather than a row pointing at nothing.
    """
    picture = await to_thread.run_sync(
        square_webp, await _read(upload, kind=kind, max_bytes=max_bytes), kind
    )

    orphaned = f"{kind.events}.orphaned_object"
    path = f"{folder}/{uuid4()}.webp"
    await storage.upload(path, picture, media_type=SQUARE_MEDIA_TYPE)
    async with discard_on_failure(storage, path, event=orphaned, **logged_as):
        url = await storage.public_url(path)
        previous = await remember(url)
    if previous is not None:
        await remove_uploaded(storage, _object_at(folder, previous), event=orphaned, **logged_as)

    logger.info(f"{kind.events}.uploaded", bytes=len(picture), **logged_as)
    return url


def _object_at(folder: str, url: str) -> str:
    """The stored object a remembered address names, which is the last segment of it."""
    return f"{folder}/{url.rsplit('/', 1)[-1]}"


def square_webp(data: bytes, kind: PictureKind) -> bytes:
    """The stored form of an uploaded picture: a square WebP, EXIF-free, at one size.

    The centre square is what survives a non-square upload — the safety net for anything that
    reaches the platform without going through the frame the portal offers.
    """
    with _decoded(data, kind) as picture:
        upright = ImageOps.exif_transpose(picture) or picture
        squared = ImageOps.fit(
            _with_readable_pixels(upright),
            (SQUARE_PIXELS, SQUARE_PIXELS),
            method=Image.Resampling.LANCZOS,
        )
        sink = io.BytesIO()
        squared.save(sink, "WEBP", quality=SQUARE_QUALITY)
        return sink.getvalue()


async def _read(upload: UploadFile, *, kind: PictureKind, max_bytes: int) -> bytes:
    received = bytearray()
    async for chunk in limited_chunks(
        upload,
        max_bytes=max_bytes,
        too_large=kind.too_large(max_bytes),
        empty=kind.empty(),
    ):
        received.extend(chunk)
    return bytes(received)


def _decoded(data: bytes, kind: PictureKind) -> Image.Image:
    """The picture an upload holds, refused rather than left to raise out of Pillow.

    `Image.open` reads the header and stops, so the size is settled while the decode that would
    allocate for every pixel has not run — the one moment a picture too big to hold can still be
    turned away.
    """
    try:
        picture = Image.open(io.BytesIO(data))
    except (DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as unreadable:
        raise kind.unreadable() from unreadable
    if picture.format not in READABLE_FORMATS:
        picture.close()
        raise kind.unreadable()
    if max(picture.size) > LARGEST_SOURCE_SIDE:
        picture.close()
        raise kind.too_many_pixels()
    try:
        picture.load()
    except (OSError, ValueError) as unreadable:
        picture.close()
        raise kind.unreadable() from unreadable
    return picture


def _with_readable_pixels(picture: Image.Image) -> Image.Image:
    """Palette and greyscale images cannot be resampled directly, and WebP takes neither."""
    return picture.convert("RGBA" if picture.mode in TRANSPARENT_MODES else "RGB")
