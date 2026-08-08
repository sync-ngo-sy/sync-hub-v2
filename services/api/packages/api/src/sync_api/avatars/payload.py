from __future__ import annotations

from pydantic import BaseModel, Field


class Avatar(BaseModel):
    avatar_url: str = Field(
        description="A public URL, good until the candidate uploads another photo.",
        examples=["https://sync.example/storage/v1/object/public/avatars/<id>/<photo>.webp"],
    )
