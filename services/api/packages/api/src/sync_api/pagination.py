from __future__ import annotations

import binascii
from base64 import urlsafe_b64decode, urlsafe_b64encode
from dataclasses import dataclass
from datetime import datetime
from typing import Final
from uuid import UUID

from sync_api.problems import INVALID_CURSOR_PROBLEM_TYPE, Problem

DEFAULT_PAGE_SIZE: Final = 20

MAX_PAGE_SIZE: Final = 100

#: Absent from any ISO timestamp or UUID, so the split cannot land inside either half.
_SEPARATOR: Final = "|"


@dataclass(frozen=True, slots=True)
class Cursor:
    created_at: datetime
    id: UUID

    def encode(self) -> str:
        raw = f"{self.created_at.isoformat()}{_SEPARATOR}{self.id}".encode()
        return urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, encoded: str) -> Cursor:
        try:
            padded = encoded + "=" * (-len(encoded) % 4)
            timestamp, separator, identifier = (
                urlsafe_b64decode(padded).decode().partition(_SEPARATOR)
            )
            if not separator:
                raise ValueError("a cursor is a timestamp and an id")
            return cls(created_at=datetime.fromisoformat(timestamp), id=UUID(identifier))
        except (ValueError, UnicodeDecodeError, binascii.Error) as unusable:
            raise Problem(
                status=422,
                type=INVALID_CURSOR_PROBLEM_TYPE,
                detail="That is not a cursor this API issued. Ask for the first page instead.",
            ) from unusable
