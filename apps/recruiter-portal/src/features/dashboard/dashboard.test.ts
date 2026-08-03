import { describe, expect, it } from 'vitest';
import type { ApplicationSummary } from '@/features/applications/application';
import type { JobSummary } from '@/features/jobs/job';
import {
  DASHBOARD_JOBS,
  type JobApplications,
  OVERVIEW_JOBS,
  RECENT_APPLICATIONS,
  readApplications,
  readJobs,
} from './dashboard';

function job(id: string, overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id,
    title: `Job ${id}`,
    status: 'published',
    location_key: null,
    location_name: null,
    employment_type: null,
    work_mode: null,
    expires_at: null,
    created_at: '2026-07-01T09:00:00Z',
    updated_at: '2026-07-01T09:00:00Z',
    ...overrides,
  };
}

function application(id: string, overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    id,
    candidate_name: `Candidate ${id}`,
    headline: null,
    location: null,
    status: 'new',
    qualification_status: 'qualified',
    applied_at: '2026-08-03T09:00:00Z',
    updated_at: '2026-08-03T09:00:00Z',
    ...overrides,
  };
}

function read(job: JobSummary, items: ApplicationSummary[], nextCursor?: string): JobApplications {
  return { job, page: { items, next_cursor: nextCursor ?? null } };
}

const NOW = new Date('2026-08-04T09:00:00Z');

describe('readJobs', () => {
  it('counts the published Jobs and the drafts beside them', () => {
    const jobs = readJobs({
      items: [
        job('a'),
        job('b', { status: 'draft' }),
        job('c'),
        job('d', { status: 'closed' }),
        job('e', { status: 'draft' }),
      ],
      next_cursor: null,
    });

    expect(jobs.open).toEqual({ value: 2, atLeast: false });
    expect(jobs.draft).toBe(2);
  });

  it('says a count is a floor when the tenant has Jobs the first page did not reach', () => {
    const jobs = readJobs({ items: [job('a')], next_cursor: 'older' });

    expect(jobs.open).toEqual({ value: 1, atLeast: true });
    expect(jobs.everyJob).toBe(false);
  });

  it('knows it has seen every Job when the first page is the only page', () => {
    const jobs = readJobs({ items: [job('a'), job('b')], next_cursor: null });

    expect(jobs.everyJob).toBe(true);
  });

  it('shows the newest Jobs whatever their state, capped at what the panel holds', () => {
    const items = Array.from({ length: OVERVIEW_JOBS + 3 }, (_, index) =>
      job(`job-${index}`, { status: index === 1 ? 'draft' : 'published' }),
    );

    const jobs = readJobs({ items, next_cursor: null });

    expect(jobs.overview).toHaveLength(OVERVIEW_JOBS);
    expect(jobs.overview[0]?.id).toBe('job-0');
    expect(jobs.overview[1]?.status).toBe('draft');
  });

  it('reads Applications for the published Jobs only, capped at the fan-out it allows', () => {
    const items = [
      job('draft-1', { status: 'draft' }),
      ...Array.from({ length: DASHBOARD_JOBS + 2 }, (_, index) => job(`published-${index}`)),
      job('closed-1', { status: 'closed' }),
    ];

    const jobs = readJobs({ items, next_cursor: null });

    expect(jobs.toCount).toHaveLength(DASHBOARD_JOBS);
    expect(jobs.toCount.every((each) => each.status === 'published')).toBe(true);
    expect(jobs.everyJob).toBe(false);
  });

  it('has seen every Job when the fan-out covers all the published ones', () => {
    const jobs = readJobs({
      items: [job('a'), job('b', { status: 'draft' })],
      next_cursor: null,
    });

    expect(jobs.toCount).toHaveLength(1);
    expect(jobs.everyJob).toBe(true);
  });
});

describe('readApplications', () => {
  const FIELD = job('field', { title: 'Field Coordinator' });
  const MEAL = job('meal', { title: 'MEAL Officer' });

  it('merges every Job newest-first and says which Job each Application went to', () => {
    const applications = readApplications(
      [
        read(FIELD, [application('older', { applied_at: '2026-08-01T09:00:00Z' })]),
        read(MEAL, [application('newest', { applied_at: '2026-08-04T08:00:00Z' })]),
      ],
      { now: NOW, everyJob: true },
    );

    expect(applications.recent.map((each) => each.application.id)).toEqual(['newest', 'older']);
    expect(applications.recent[0]?.job.title).toBe('MEAL Officer');
    expect(applications.recent[1]?.job.title).toBe('Field Coordinator');
  });

  it('shows only as many Applications as the panel holds', () => {
    const items = Array.from({ length: RECENT_APPLICATIONS + 4 }, (_, index) =>
      application(`app-${index}`),
    );

    const applications = readApplications([read(FIELD, items)], { now: NOW, everyJob: true });

    expect(applications.recent).toHaveLength(RECENT_APPLICATIONS);
    expect(applications.counted).toBe(RECENT_APPLICATIONS + 4);
  });

  it('counts the last seven days, the last day, and what is waiting to be reviewed', () => {
    const applications = readApplications(
      [
        read(FIELD, [
          application('today', { applied_at: '2026-08-04T07:00:00Z' }),
          application('this-week', { applied_at: '2026-07-31T09:00:00Z', status: 'reviewing' }),
          application('last-month', { applied_at: '2026-07-01T09:00:00Z' }),
        ]),
      ],
      { now: NOW, everyJob: true },
    );

    expect(applications.thisWeek).toEqual({ value: 2, atLeast: false });
    expect(applications.today).toBe(1);
    expect(applications.awaitingReview).toEqual({ value: 2, atLeast: false });
  });

  it('counts the Screening verdicts and the rate it passed the decided ones at', () => {
    const applications = readApplications(
      [
        read(FIELD, [
          application('one', { qualification_status: 'qualified' }),
          application('two', { qualification_status: 'qualified' }),
          application('three', { qualification_status: 'qualified' }),
          application('four', { qualification_status: 'disqualified' }),
          application('five', { qualification_status: 'pending' }),
          application('six', { qualification_status: 'review_required' }),
        ]),
      ],
      { now: NOW, everyJob: true },
    );

    expect(applications.qualified).toEqual({ value: 3, atLeast: false });
    expect(applications.passRate).toBe(75);
  });

  it('has no pass rate to give when Screening has decided nothing', () => {
    const applications = readApplications(
      [read(FIELD, [application('one', { qualification_status: 'pending' })])],
      { now: NOW, everyJob: true },
    );

    expect(applications.passRate).toBeNull();
  });

  it('says every count is a floor when a Job had more Applications than one page holds', () => {
    const applications = readApplications([read(FIELD, [application('one')], 'older')], {
      now: NOW,
      everyJob: true,
    });

    expect(applications.thisWeek.atLeast).toBe(true);
    expect(applications.awaitingReview.atLeast).toBe(true);
    expect(applications.qualified.atLeast).toBe(true);
  });

  it("says every count is a floor when some of the tenant's Jobs went unread", () => {
    const applications = readApplications([read(FIELD, [application('one')])], {
      now: NOW,
      everyJob: false,
    });

    expect(applications.thisWeek.atLeast).toBe(true);
    expect(applications.awaitingReview.atLeast).toBe(true);
    expect(applications.qualified.atLeast).toBe(true);
  });

  it('counts nothing, and claims nothing, when no Job has an Application', () => {
    const applications = readApplications([read(FIELD, []), read(MEAL, [])], {
      now: NOW,
      everyJob: true,
    });

    expect(applications.recent).toEqual([]);
    expect(applications.counted).toBe(0);
    expect(applications.thisWeek).toEqual({ value: 0, atLeast: false });
    expect(applications.passRate).toBeNull();
  });
});
