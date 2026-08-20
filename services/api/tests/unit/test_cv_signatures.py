from __future__ import annotations

from sync_api.cvs.upload import SIGNATURES_BY_MEDIA_TYPE
from sync_core.storage import CV_MEDIA_TYPES


def test_every_accepted_media_type_has_a_signature_to_read_it_by() -> None:
    assert SIGNATURES_BY_MEDIA_TYPE.keys() == CV_MEDIA_TYPES.keys()
