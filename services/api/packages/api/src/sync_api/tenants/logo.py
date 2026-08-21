from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field
from sqlalchemy import select

from sync_api.pictures import PictureKind, replace_picture
from sync_api.problems import (
    TENANT_LOGO_EMPTY_PROBLEM_TYPE,
    TENANT_LOGO_MEDIA_TYPE_PROBLEM_TYPE,
    TENANT_LOGO_TOO_LARGE_PROBLEM_TYPE,
    TENANT_LOGO_TOO_MANY_PIXELS_PROBLEM_TYPE,
)
from sync_core import transaction
from sync_core.models import Tenant
from sync_core.storage import picture_folder

if TYPE_CHECKING:
    from uuid import UUID

    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings, Storage

TENANT_LOGO = PictureKind(
    events="tenant_logos",
    subject="A logo",
    unreadable_type=TENANT_LOGO_MEDIA_TYPE_PROBLEM_TYPE,
    too_large_type=TENANT_LOGO_TOO_LARGE_PROBLEM_TYPE,
    too_many_pixels_type=TENANT_LOGO_TOO_MANY_PIXELS_PROBLEM_TYPE,
    empty_type=TENANT_LOGO_EMPTY_PROBLEM_TYPE,
)


class TenantLogo(BaseModel):
    """Where the Tenant's logo now answers, for an `<img>` to read."""

    logo_url: str = Field(description="Public and stable until the logo is replaced again.")


class TenantLogoService:
    def __init__(self, session: AsyncSession, storage: Storage, settings: Settings) -> None:
        self._db = session
        self._storage = storage
        self._settings = settings

    async def replace(self, tenant_id: UUID, upload: UploadFile) -> TenantLogo:
        url = await replace_picture(
            self._storage,
            upload,
            kind=TENANT_LOGO,
            folder=picture_folder(tenant_id),
            max_bytes=self._settings.tenant_logo_max_upload_bytes,
            remember=lambda address: self._remember(tenant_id, address),
            logged_as={"tenant_id": str(tenant_id)},
        )
        return TenantLogo(logo_url=url)

    async def _remember(self, tenant_id: UUID, url: str) -> str | None:
        async with transaction(self._db):
            tenant = await self._db.scalar(
                select(Tenant).where(Tenant.id == tenant_id).with_for_update()
            )
            if tenant is None:  # pragma: no cover — the acting admin recruits for one
                raise LookupError(f"tenant {tenant_id} has no row")
            previous = tenant.logo_url
            tenant.logo_url = url
        return previous
