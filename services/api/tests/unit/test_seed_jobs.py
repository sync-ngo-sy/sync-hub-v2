"""The seed writes its Jobs through the API, so a cast that breaks a Job rule breaks the run —
after it has already made three Tenants and nine Candidates. These read the cast instead."""

from __future__ import annotations

import pytest
from seed.cast import JOBS, SeededJob

from sync_api.jobs.service import TRAVELLED_TO
from sync_core.models import JobStatus, WorkMode

PUBLISHED = [job for job in JOBS if job.status is JobStatus.PUBLISHED]


@pytest.mark.parametrize("job", PUBLISHED, ids=lambda job: job.key)
def test_a_published_seeded_job_says_how_it_is_worked(job: SeededJob) -> None:
    assert job.new.work_mode is not None


@pytest.mark.parametrize("job", JOBS, ids=lambda job: job.key)
def test_a_seeded_job_people_travel_to_names_the_place(job: SeededJob) -> None:
    if job.new.work_mode in TRAVELLED_TO:
        assert job.new.location_key is not None


def test_the_seed_leaves_one_job_open_to_anywhere() -> None:
    """Browsing by any Location has to meet something, or the demo cannot show what Anywhere is."""
    anywhere = [
        job
        for job in PUBLISHED
        if job.new.work_mode is WorkMode.REMOTE and job.new.location_key is None
    ]

    assert anywhere, "no published Job in the cast reads as Anywhere"
