from __future__ import annotations

import io
from typing import Final

from PIL import Image, ImageOps, UnidentifiedImageError

from sync_api.problems import AVATAR_MEDIA_TYPE_PROBLEM_TYPE, Problem

#: The one size an avatar is stored at. Every consumer scales down from it.
AVATAR_PIXELS: Final = 512

AVATAR_QUALITY: Final = 80

AVATAR_MEDIA_TYPE: Final = "image/webp"

AVATAR_FORMATS: Final = frozenset({"JPEG", "PNG", "WEBP"})

ACCEPTED_FORMATS: Final = "JPEG, PNG or WebP"

TRANSPARENT_MODES: Final = frozenset({"RGBA", "LA", "PA", "P"})


def avatar_webp(data: bytes) -> bytes:
    """The stored form of an uploaded photo: a square WebP, EXIF-free, at one size.

    The centre square is what survives a non-square upload — the safety net for anything that
    reaches the platform without going through the crop the portal offers.
    """
    with _decoded(data) as photo:
        upright = ImageOps.exif_transpose(photo) or photo
        squared = ImageOps.fit(
            _with_readable_pixels(upright),
            (AVATAR_PIXELS, AVATAR_PIXELS),
            method=Image.Resampling.LANCZOS,
        )
        sink = io.BytesIO()
        squared.save(sink, "WEBP", quality=AVATAR_QUALITY)
        return sink.getvalue()


def _decoded(data: bytes) -> Image.Image:
    try:
        photo = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError, ValueError) as unreadable:
        raise _not_a_photo() from unreadable
    if photo.format not in AVATAR_FORMATS:
        photo.close()
        raise _not_a_photo()
    return photo


def _with_readable_pixels(photo: Image.Image) -> Image.Image:
    """Palette and greyscale images cannot be resampled directly, and WebP takes neither."""
    return photo.convert("RGBA" if photo.mode in TRANSPARENT_MODES else "RGB")


def _not_a_photo() -> Problem:
    return Problem(
        status=415,
        type=AVATAR_MEDIA_TYPE_PROBLEM_TYPE,
        detail=f"A profile photo has to be a {ACCEPTED_FORMATS} image.",
    )
