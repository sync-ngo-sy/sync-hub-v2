from __future__ import annotations

from typing import TYPE_CHECKING

from sync_ingestion import CvIngestion
from sync_worker import CvIngestionConsumer, QueueEngine, RetryPolicy

if TYPE_CHECKING:
    from sync_core import Database, Storage
    from sync_parsers import CvExtractor, ParsedCv

NO_WAITING = 0.001


def an_ingestion_worker(
    database: Database,
    storage: Storage,
    extractor: CvExtractor,
    *,
    max_attempts: int = 3,
    stuck_after_seconds: float = 600.0,
) -> QueueEngine[ParsedCv]:
    return QueueEngine(
        database,
        CvIngestionConsumer(CvIngestion(database, storage, extractor)),
        RetryPolicy(
            max_attempts=max_attempts,
            backoff_seconds=NO_WAITING,
            stuck_after_seconds=stuck_after_seconds,
        ),
    )
