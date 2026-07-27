"""The private `cvs` bucket, reached with the service role.

Two processes need it and neither is allowed to skip it. The API streams an upload in and
issues the short-lived links a CV is downloaded through; the worker reads the file back out
to send to the model. No client ever touches Storage — `storage.objects` has RLS enabled
with no policies (migration 10), so a browser holding a Supabase key gets nothing.

`supabase-py`'s storage client, per ADR-0004, over an HTTP client this owns and closes —
the same arrangement `sync_api.auth.Authentication` makes for GoTrue.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, Literal

from httpx import AsyncClient, HTTPError
from storage3 import AsyncStorageClient
from storage3.utils import StorageException

from sync_core.logging import get_logger

if TYPE_CHECKING:
    from io import BufferedReader

    from storage3._async.file_api import AsyncBucketProxy

    from sync_core.settings import Settings

logger = get_logger(__name__)

#: The bucket migration 10 creates. Not configurable: which bucket CVs live in is part of
#: the schema, and a deployment pointed at a different one would be pointed at a bucket
#: with no size limit and no MIME allow-list.
CV_BUCKET: Final = "cvs"

#: The bucket's `allowed_mime_types`, mapped to the extension a stored object gets. Here
#: rather than in the API because both ends need it: the API decides what it will accept,
#: and the worker decides what to tell the model it is sending.
CV_MEDIA_TYPES: Final[dict[str, str]] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

CV_MEDIA_TYPE_BY_EXTENSION: Final[dict[str, str]] = {
    extension: media_type for media_type, extension in CV_MEDIA_TYPES.items()
}

#: For a stored path whose extension says nothing — which the API cannot produce, so this
#: is a floor under a row written by something else rather than a case that happens.
DEFAULT_CV_MEDIA_TYPE: Final = "application/pdf"

#: Long enough for a 10 MB upload over a slow link, short enough that a stalled Storage
#: cannot pin a request worker indefinitely.
STORAGE_TIMEOUT_SECONDS: Final = 60

#: What Storage calls a missing object, across the versions that have called it different
#: things. Checked alongside the status, because a 404 has arrived as a `400` before.
MISSING_OBJECT_CODES: Final = frozenset({"NoSuchKey", "not_found"})


class StorageError(Exception):
    """Storage refused, or could not be reached."""


class ObjectNotFoundError(StorageError):
    """No object at that path — it was never written, or something removed it."""


class Storage:
    """Everything the platform does to the `cvs` bucket, and nothing else."""

    def __init__(self, client: AsyncStorageClient, http: AsyncClient, *, bucket: str) -> None:
        self._client = client
        self._http = http
        self._bucket_name = bucket

    @classmethod
    def build(cls, settings: Settings, *, bucket: str = CV_BUCKET) -> Storage:
        http = AsyncClient(timeout=STORAGE_TIMEOUT_SECONDS)
        key = settings.supabase_service_role_key.get_secret_value()
        return cls(
            AsyncStorageClient(
                # Trailing slash: the SDK appends one itself and warns when it has to, and
                # the suite runs with warnings as errors.
                url=f"{settings.storage_url}/",
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                http_client=http,
            ),
            http,
            bucket=bucket,
        )

    async def upload(self, path: str, content: BufferedReader, *, media_type: str) -> None:
        """Write an object, streaming from an open file rather than buffering it.

        `content` is read to its end and left open; the caller owns it. Deliberately not
        an upsert: every path this writes carries a fresh CV id, so a path that already
        exists is a bug worth hearing about rather than an overwrite worth performing.
        """
        with _storage_failures("upload", path):
            await self._bucket.upload(path, content, {"content-type": media_type})

    async def download(self, path: str) -> bytes:
        """The whole object. Bounded by the bucket's own 10 MB `file_size_limit`."""
        with _storage_failures("download", path):
            return await self._bucket.download(path)

    async def signed_url(self, path: str, *, expires_in: int) -> str:
        """A URL that fetches this object without a session, until it expires.

        The only way anything outside the backend reads a CV. Short-lived because it is a
        bearer URL: whoever holds it is whoever can read the document.
        """
        with _storage_failures("sign", path):
            answered = await self._bucket.create_signed_url(path, expires_in)
        url = answered.get("signedURL") or answered.get("signedUrl")
        if not url:
            raise StorageError(f"Storage signed {path} with a URL we cannot read")
        return url

    async def remove(self, path: str) -> None:
        """Delete an object. Used to undo an upload whose database row did not land."""
        with _storage_failures("remove", path):
            await self._bucket.remove([path])

    @property
    def _bucket(self) -> AsyncBucketProxy:
        return self._client.from_(self._bucket_name)

    async def aclose(self) -> None:
        await self._http.aclose()


class _storage_failures:  # noqa: N801 — reads as a statement at the call site, not as a type
    """Translate Storage's own errors into this module's two, and log the rest.

    A missing object is the one failure a caller can act on — the worker meets it when a
    CV row outlives its file — so it gets its own type. Everything else is Storage being
    unavailable as far as any caller is concerned.
    """

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
