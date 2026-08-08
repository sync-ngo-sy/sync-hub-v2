from __future__ import annotations

from pathlib import PurePosixPath
from typing import TYPE_CHECKING, Final, Literal

from httpx import AsyncClient, HTTPError
from storage3 import AsyncStorageClient
from storage3.utils import StorageException

from sync_core.logging import get_logger

if TYPE_CHECKING:
    from io import BufferedReader
    from uuid import UUID

    from storage3._async.file_api import AsyncBucketProxy

    from sync_core.settings import Settings

logger = get_logger(__name__)

CV_BUCKET: Final = "cvs"

AVATAR_BUCKET: Final = "avatars"

CV_MEDIA_TYPES: Final[dict[str, str]] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

CV_MEDIA_TYPE_BY_EXTENSION: Final[dict[str, str]] = {
    extension: media_type for media_type, extension in CV_MEDIA_TYPES.items()
}

DEFAULT_CV_MEDIA_TYPE: Final = "application/pdf"


def cv_object_path(candidate_id: UUID, cv_id: UUID, media_type: str) -> str:
    return f"{candidate_id}/{cv_id}{CV_MEDIA_TYPES[media_type]}"


def avatar_object_path(candidate_id: UUID, avatar_id: UUID) -> str:
    """A fresh name per upload, so a replaced photo cannot be served from anyone's cache."""
    return f"{candidate_id}/{avatar_id}.webp"


def cv_media_type_of(storage_path: str) -> str:
    return CV_MEDIA_TYPE_BY_EXTENSION.get(
        PurePosixPath(storage_path).suffix.lower(), DEFAULT_CV_MEDIA_TYPE
    )


STORAGE_TIMEOUT_SECONDS: Final = 60

MISSING_OBJECT_CODES: Final = frozenset({"NoSuchKey", "not_found"})


class StorageError(Exception):
    pass


class ObjectNotFoundError(StorageError):
    pass


class Storage:
    """One bucket, reached with the service-role key. Build one per bucket the API writes."""

    def __init__(self, client: AsyncStorageClient, http: AsyncClient, *, bucket: str) -> None:
        self._client = client
        self._http = http
        self._name = bucket

    @classmethod
    def build(cls, settings: Settings, *, bucket: str = CV_BUCKET) -> Storage:
        http = AsyncClient(timeout=STORAGE_TIMEOUT_SECONDS)
        key = settings.supabase_service_role_key.get_secret_value()
        return cls(
            AsyncStorageClient(
                # Trailing slash: the SDK appends one itself and warns when it has to, and the suite
                # runs with warnings as errors.
                url=f"{settings.storage_url}/",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                http_client=http,
            ),
            http,
            bucket=bucket,
        )

    async def upload(self, path: str, content: BufferedReader | bytes, *, media_type: str) -> None:
        with _storage_failures("upload", path):
            await self._bucket.upload(path, content, {"content-type": media_type})

    async def public_url(self, path: str) -> str:
        """Where a reader fetches the object. Only a public bucket answers it."""
        with _storage_failures("address", path):
            return await self._bucket.get_public_url(path)

    async def download(self, path: str) -> bytes:
        with _storage_failures("download", path):
            return await self._bucket.download(path)

    async def signed_url(self, path: str, *, expires_in: int) -> str:
        with _storage_failures("sign", path):
            answered = await self._bucket.create_signed_url(path, expires_in)
        url = answered.get("signedURL") or answered.get("signedUrl")
        if not url:
            raise StorageError(f"Storage signed {path} with a URL we cannot read")
        return url

    async def remove(self, path: str) -> None:
        with _storage_failures("remove", path):
            await self._bucket.remove([path])

    async def paths_under(self, folder: str) -> list[str]:
        with _storage_failures("list", folder):
            entries = await self._bucket.list(folder)
        return [f"{folder}/{entry['name']}" for entry in entries if entry.get("id")]

    @property
    def _bucket(self) -> AsyncBucketProxy:
        return self._client.from_(self._name)

    async def aclose(self) -> None:
        await self._http.aclose()


class _storage_failures:  # noqa: N801 — reads as a statement at the call site, not as a type
    def __init__(self, step: str, path: str) -> None:
        self._step = step
        self._path = path

    def __enter__(self) -> None:
        return None

    def __exit__(
        self, kind: object, exc: BaseException | None, traceback: object
    ) -> Literal[False]:
        if isinstance(exc, HTTPError):
            logger.warning("storage.unreachable", step=self._step, error=type(exc).__name__)
            raise StorageError(f"Storage did not answer the {self._step}") from exc
        if not isinstance(exc, StorageException):
            return False
        status = getattr(exc, "status", None)
        code = str(getattr(exc, "code", ""))
        logger.warning(
            "storage.failed",
            step=self._step,
            path=self._path,
            status=status,
            code=code,
            error=str(exc),
        )
        if str(status) == "404" or code in MISSING_OBJECT_CODES:
            raise ObjectNotFoundError(f"no object at {self._path}") from exc
        raise StorageError(f"Storage could not {self._step} {self._path}") from exc
