"""Driving the worker one claim-process cycle at a time.

Seam 3 of the testing plan. Nothing here runs the poll loop: a test uploads a CV over HTTP,
calls `run_once()`, and asserts on the database — so what is under test is the claim, the
work and the outcome, with no sleeping and nothing timing-dependent about it.

The retry policy is the test's to choose, because the real one waits ten seconds before a
second attempt and a suite cannot afford to find out whether it meant it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sync_ingestion import CvIngestion
from sync_worker import CvIngestionConsumer, QueueEngine, RetryPolicy

if TYPE_CHECKING:
    from sync_core import Database, Storage
    from sync_parsers import CvExtractor, ParsedCv

#: No wait between attempts, so a test can drive three of them in a row. The backoff
#: *arithmetic* is asserted directly against `RetryPolicy`; what the queue tests care
#: about is which state a failure leaves behind, not how long it waits there.
NO_WAITING = 0.001


def an_ingestion_worker(
    database: Database,
    storage: Storage,
    extractor: CvExtractor,
    *,
    max_attempts: int = 3,
    stuck_after_seconds: float = 600.0,
) -> QueueEngine[ParsedCv]:
    """A worker draining `ingestion_jobs`, assembled exactly as the real process does."""
    return QueueEngine(
        database,
        CvIngestionConsumer(CvIngestion(database, storage, extractor)),
        RetryPolicy(
            max_attempts=max_attempts,
            backoff_seconds=NO_WAITING,
            stuck_after_seconds=stuck_after_seconds,
        ),
    )
