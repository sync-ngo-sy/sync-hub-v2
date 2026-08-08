from __future__ import annotations

from typing import TYPE_CHECKING
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
from sync_api.uploads import discard_on_failure, limited_chunks, remove_uploaded
from sync_core import StorageError, get_logger, transaction
from sync_core.models import Profile
from sync_core.storage import avatar_folder, avatar_object_path, avatar_path_from_url

if TYPE_CHECKING:
    from uuid import UUID

    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings, Storage

logger = get_logger(__name__)


async def remove_avatar_folder(storage: Storage, candidate_id: UUID) -> None:
    try:
        for path in await storage.paths_under(avatar_folder(candidate_id)):
            try:
                await storage.remove(path)
            except StorageError as error:
                logger.error(
                    "avatars.orphaned_object",
                    candidate_id=str(candidate_id),
                    object_path=path,
                    error=str(error),
                )
    except StorageError as error:
        logger.error("avatars.cleanup_failed", candidate_id=str(candidate_id), error=str(error))


class AvatarService:
    def __init__(self, session: AsyncSession, storage: Storage, settings: Settings) -> None:
        self._db = session
        self._storage = storage
        self._settings = settings

    async def replace(self, candidate_id: UUID, upload: UploadFile) -> Avatar:
        photo = await to_thread.run_sync(
            avatar_webp, await self._read(upload, max_bytes=self._settings.avatar_max_upload_bytes)
        )

        path = avatar_object_path(candidate_id, uuid4())
        await self._storage.upload(path, photo, media_type=AVATAR_MEDIA_TYPE)
        async with discard_on_failure(
            self._storage,
            path,
            event="avatars.orphaned_object",
            candidate_id=str(candidate_id),
        ):
            url = await self._storage.public_url(path)
            previous = await self._remember(candidate_id, url)
        if previous is not None:
            await remove_uploaded(
                self._storage,
                avatar_path_from_url(candidate_id, previous),
                event="avatars.orphaned_object",
                candidate_id=str(candidate_id),
            )

        logger.info("avatars.uploaded", candidate_id=str(candidate_id), bytes=len(photo))
        return Avatar(avatar_url=url)

    async def _read(self, upload: UploadFile, *, max_bytes: int) -> bytes:
        received = bytearray()
        async for chunk in limited_chunks(
            upload,
            max_bytes=max_bytes,
            too_large=Problem(
                status=413,
                type=AVATAR_TOO_LARGE_PROBLEM_TYPE,
                detail=f"A profile photo has to be {max_bytes // (1024 * 1024)} MB or "
                f"smaller. Crop it or pick a smaller {ACCEPTED_FORMATS} file.",
            ),
            empty=Problem(
                status=422,
                type=AVATAR_EMPTY_PROBLEM_TYPE,
                detail="The file you picked is empty.",
            ),
        ):
            received.extend(chunk)
        return bytes(received)

    async def _remember(self, candidate_id: UUID, url: str) -> str | None:
        async with transaction(self._db):
            profile = await self._db.scalar(
                select(Profile).where(Profile.id == candidate_id).with_for_update()
            )
            if profile is None:  # pragma: no cover — the acting candidate is one
                raise LookupError(f"candidate {candidate_id} has no profile row")
            previous = profile.avatar_url
            profile.avatar_url = url
        return previous
