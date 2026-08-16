from __future__ import annotations

from typing import TYPE_CHECKING

from sync_assessments import MatchAssessing
from sync_comms import CommunicationDelivery
from sync_ingestion import CvIngestion
from sync_rag import ProfileEmbedding
from sync_worker import (
    CommunicationsConsumer,
    CvIngestionConsumer,
    MatchAssessmentConsumer,
    QueueEngine,
    ReembedEngine,
    ReembedPolicy,
    RetryPolicy,
)

if TYPE_CHECKING:
    from sync_assessments import AssessedMatch, MatchAssessor
    from sync_comms import Delivered, EmailSender
    from sync_core import Database, Storage
    from sync_parsers import CvExtractor, ParsedCv
    from sync_rag import Embedder

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


def an_assessment_worker(
    database: Database,
    assessor: MatchAssessor,
    *,
    max_attempts: int = 3,
    stuck_after_seconds: float = 600.0,
) -> QueueEngine[AssessedMatch]:
    return QueueEngine(
        database,
        MatchAssessmentConsumer(MatchAssessing(database, assessor)),
        RetryPolicy(
            max_attempts=max_attempts,
            backoff_seconds=NO_WAITING,
            stuck_after_seconds=stuck_after_seconds,
        ),
    )


def a_communications_worker(
    database: Database,
    sender: EmailSender,
    *,
    max_attempts: int = 3,
    stuck_after_seconds: float = 600.0,
) -> QueueEngine[Delivered]:
    return QueueEngine(
        database,
        CommunicationsConsumer(CommunicationDelivery(database, sender)),
        RetryPolicy(
            max_attempts=max_attempts,
            backoff_seconds=NO_WAITING,
            stuck_after_seconds=stuck_after_seconds,
        ),
    )


def a_reembed_worker(
    database: Database,
    embedder: Embedder,
    *,
    backoff_seconds: float = NO_WAITING,
    stuck_after_seconds: float = 600.0,
) -> ReembedEngine:
    return ReembedEngine(
        database,
        ProfileEmbedding(database, embedder),
        ReembedPolicy(backoff_seconds=backoff_seconds, stuck_after_seconds=stuck_after_seconds),
    )


async def drain(engine: ReembedEngine) -> int:
    drained = 0
    while await engine.run_once():
        drained += 1
    return drained
