from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.avatars.payload import Avatar
from sync_api.pictures import PictureKind, replace_picture
from sync_api.problems import (
    AVATAR_EMPTY_PROBLEM_TYPE,
    AVATAR_MEDIA_TYPE_PROBLEM_TYPE,
    AVATAR_TOO_LARGE_PROBLEM_TYPE,
)
from sync_core import StorageError, get_logger, transaction
from sync_core.models import Profile
from sync_core.storage import picture_folder

if TYPE_CHECKING:
    from uuid import UUID

    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings, Storage

logger = get_logger(__name__)

AVATAR = PictureKind(
    events="avatars",
    subject="A profile photo",
    unreadable_type=AVATAR_MEDIA_TYPE_PROBLEM_TYPE,
    too_large_type=AVATAR_TOO_LARGE_PROBLEM_TYPE,
    empty_type=AVATAR_EMPTY_PROBLEM_TYPE,
)


async def remove_avatar_folder(storage: Storage, candidate_id: UUID) -> None:
    try:
        for path in await storage.paths_under(picture_folder(candidate_id)):
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
        url = await replace_picture(
            self._storage,
            upload,
            kind=AVATAR,
            folder=picture_folder(candidate_id),
            max_bytes=self._settings.avatar_max_upload_bytes,
            remember=lambda address: self._remember(candidate_id, address),
            logged_as={"candidate_id": str(candidate_id)},
        )
        return Avatar(avatar_url=url)

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
