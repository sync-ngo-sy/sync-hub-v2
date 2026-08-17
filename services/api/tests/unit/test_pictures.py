from __future__ import annotations

import io
from typing import Final

import pytest
from PIL import Image

from sync_api.avatars import AVATAR
from sync_api.pictures import SQUARE_PIXELS, square_webp
from sync_api.problems import (
    AVATAR_MEDIA_TYPE_PROBLEM_TYPE,
    TENANT_LOGO_MEDIA_TYPE_PROBLEM_TYPE,
    Problem,
)
from sync_api.tenants import TENANT_LOGO

RED: Final = (220, 30, 30)
BLUE: Final = (30, 60, 220)

ROTATE_90_CLOCKWISE_TO_DISPLAY: Final = 6
ORIENTATION_TAG: Final = 0x0112


def encoded(image: Image.Image, image_format: str, **options: object) -> bytes:
    sink = io.BytesIO()
    image.save(sink, image_format, **options)
    return sink.getvalue()


def halves(width: int, height: int, *, vertical_split: bool) -> Image.Image:
    image = Image.new("RGB", (width, height), BLUE)
    half = (width // 2, height) if vertical_split else (width, height // 2)
    image.paste(Image.new("RGB", half, RED), (0, 0))
    return image


def middle_band(width: int, height: int) -> Image.Image:
    """Wide, with a square of red in the middle and blue either side of it."""
    image = Image.new("RGB", (width, height), BLUE)
    left = (width - height) // 2
    image.paste(Image.new("RGB", (height, height), RED), (left, 0))
    return image


def looks_like(pixel: tuple[int, ...], colour: tuple[int, int, int]) -> bool:
    return all(abs(was - wanted) <= 24 for was, wanted in zip(pixel[:3], colour, strict=True))


def opened(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def stored_form(data: bytes) -> bytes:
    return square_webp(data, AVATAR)


def test_re_encodes_to_a_square_webp() -> None:
    stored = opened(stored_form(encoded(middle_band(900, 300), "JPEG")))

    assert stored.format == "WEBP"
    assert stored.size == (SQUARE_PIXELS, SQUARE_PIXELS)


def test_keeps_the_middle_of_a_wide_photo() -> None:
    stored = opened(stored_form(encoded(middle_band(900, 300), "JPEG"))).convert("RGB")

    corners = [(4, 4), (SQUARE_PIXELS - 5, 4), (4, SQUARE_PIXELS - 5)]
    assert all(looks_like(stored.getpixel(corner), RED) for corner in corners)  # type: ignore[arg-type]


def test_keeps_the_middle_of_a_tall_photo() -> None:
    tall = middle_band(900, 300).transpose(Image.Transpose.ROTATE_90)

    stored = opened(stored_form(encoded(tall, "JPEG"))).convert("RGB")

    assert looks_like(stored.getpixel((SQUARE_PIXELS // 2, SQUARE_PIXELS // 2)), RED)  # type: ignore[arg-type]


def test_grows_a_photo_smaller_than_the_stored_size() -> None:
    stored = opened(stored_form(encoded(halves(64, 64, vertical_split=True), "PNG")))

    assert stored.size == (SQUARE_PIXELS, SQUARE_PIXELS)


def test_turns_the_photo_the_way_its_exif_says_it_is_held() -> None:
    landscape = halves(400, 200, vertical_split=True)
    exif = landscape.getexif()
    exif[ORIENTATION_TAG] = ROTATE_90_CLOCKWISE_TO_DISPLAY

    stored = opened(stored_form(encoded(landscape, "JPEG", exif=exif))).convert("RGB")

    assert looks_like(stored.getpixel((SQUARE_PIXELS // 2, 40)), RED)  # type: ignore[arg-type]
    assert looks_like(stored.getpixel((SQUARE_PIXELS // 2, SQUARE_PIXELS - 40)), BLUE)  # type: ignore[arg-type]


def test_strips_exif() -> None:
    portrait = halves(400, 400, vertical_split=True)
    exif = portrait.getexif()
    exif[ORIENTATION_TAG] = ROTATE_90_CLOCKWISE_TO_DISPLAY
    exif[0x010E] = "taken at home"

    stored = opened(stored_form(encoded(portrait, "JPEG", exif=exif)))

    assert dict(stored.getexif()) == {}
    assert "exif" not in stored.info


def test_keeps_transparency() -> None:
    transparent = Image.new("RGBA", (200, 200), (*RED, 0))

    stored = opened(stored_form(encoded(transparent, "PNG")))

    assert stored.mode == "RGBA"
    assert stored.convert("RGBA").getpixel((10, 10))[3] == 0  # type: ignore[index]


def test_refuses_an_image_format_the_platform_does_not_take() -> None:
    with pytest.raises(Problem) as refusal:
        stored_form(encoded(halves(200, 200, vertical_split=True), "GIF"))

    assert refusal.value.status == 415
    assert refusal.value.type == AVATAR_MEDIA_TYPE_PROBLEM_TYPE
    assert "JPEG, PNG or WebP" in (refusal.value.detail or "")


def test_refuses_bytes_that_are_not_an_image() -> None:
    with pytest.raises(Problem) as refusal:
        stored_form(b"this is not a photograph")

    assert refusal.value.status == 415
    assert refusal.value.type == AVATAR_MEDIA_TYPE_PROBLEM_TYPE


def test_calls_a_logo_a_logo_when_it_refuses_one() -> None:
    with pytest.raises(Problem) as refusal:
        square_webp(b"this is not a logo", TENANT_LOGO)

    assert refusal.value.status == 415
    assert refusal.value.type == TENANT_LOGO_MEDIA_TYPE_PROBLEM_TYPE
    assert (refusal.value.detail or "").startswith("A logo")
