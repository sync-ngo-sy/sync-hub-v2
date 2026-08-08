from __future__ import annotations

from typing import TYPE_CHECKING, Final
from uuid import uuid4

from anyio import to_thread
from sqlalchemy import select

from sync_api.avatars.image import ACCEPTED_FORMATS, AVATAR_MEDIA_TYPE, avatar_webp
from sync_api.avatars.payload import Avatar
from sync_api.problems import (
    AVATAR_EMPTY_PROBLEM_TYPE,
    AVATAR_TOO_LARGE_PROBLEM_TYPE,
    Problem,
)
from sync_core import StorageError, get_logger, transaction
from sync_core.models import Profile
from sync_core.storage import avatar_object_path

if TYPE_CHECKING:
    from uuid import UUID

    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings, Storage

logger = get_logger(__name__)

READ_CHUNK_BYTES: Final = 256 * 1024


async def forget_photos(
    storage: Storage, candidate_id: UUID, *, keeping: str | None = None
) -> None:
    """Drop every stored photo of this candidate bar the one at `keeping`.

    Whatever else sits in their folder is the photo they just replaced, or the wreckage of an
    upload that failed after writing. Nothing serves either, so failing to sweep is logged
    rather than raised — it costs storage, and never correctness.
    """
    try:
        for path in await storage.paths_under(str(candidate_id)):
            if path != keeping:
                await storage.remove(path)
    except StorageError as error:
        logger.error("avatars.orphaned_object", candidate_id=str(candidate_id), error=str(error))


class AvatarService:
    def __init__(self, session: AsyncSession, storage: Storage, settings: Settings) -> None:
        self._db = session
        self._storage = storage
        self._settings = settings

    async def replace(self, candidate_id: UUID, upload: UploadFile) -> Avatar:
        """Store the photo the candidate picked, and leave nothing of the one it replaces."""
        photo = await to_thread.run_sync(
            avatar_webp, await self._read(upload, max_bytes=self._settings.avatar_max_upload_bytes)
        )

        path = avatar_object_path(candidate_id, uuid4())
        await self._storage.upload(path, photo, media_type=AVATAR_MEDIA_TYPE)
        url = await self._storage.public_url(path)
        try:
            await self._remember(candidate_id, url)
        except BaseException:
            await self._discard(path)
            raise
        await forget_photos(self._storage, candidate_id, keeping=path)

        logger.info("avatars.uploaded", candidate_id=str(candidate_id), bytes=len(photo))
        return Avatar(avatar_url=url)

    async def _read(self, upload: UploadFile, *, max_bytes: int) -> bytes:
        received = bytearray()
        while chunk := await upload.read(READ_CHUNK_BYTES):
            received.extend(chunk)
            if len(received) > max_bytes:
                raise Problem(
                    status=413,
                    type=AVATAR_TOO_LARGE_PROBLEM_TYPE,
                    detail=f"A profile photo has to be {max_bytes // (1024 * 1024)} MB or "
                    f"smaller. Crop it or pick a smaller {ACCEPTED_FORMATS} file.",
                )
        if not received:
            raise Problem(
                status=422,
                type=AVATAR_EMPTY_PROBLEM_TYPE,
                detail="The file you picked is empty.",
            )
        return bytes(received)

    async def _remember(self, candidate_id: UUID, url: str) -> None:
        async with transaction(self._db):
            profile = await self._db.scalar(select(Profile).where(Profile.id == candidate_id))
            if profile is None:  # pragma: no cover — the acting candidate is one
                raise LookupError(f"candidate {candidate_id} has no profile row")
            profile.avatar_url = url

    async def _discard(self, path: str) -> None:
        try:
            await self._storage.remove(path)
        except StorageError as error:
            logger.error("avatars.orphaned_object", path=path, error=str(error))
