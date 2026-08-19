import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { delay } from 'msw';
import type { Job, JobSummary } from '@/features/jobs/job';
import { DEAD_TRACKED_LINK, NO_SUCH_JOB, TOO_MANY_REQUESTS } from '@/testing/fixtures';

type Problem = components['schemas']['ProblemDetail'];

type AskedQuery = (query: URLSearchParams) => void;

const asked = (request: Request) => new URL(request.url).searchParams;

export function listsJobs(items: JobSummary[]) {
  return [http.get('/v1/jobs', ({ response }) => response(200).json({ items, next_cursor: null }))];
}

export function publishesNothing() {
  return listsJobs([]);
}

export function pagesJobs(pages: JobSummary[][], onQuery?: AskedQuery) {
  return [
    http.get('/v1/jobs', ({ response, query, request }) => {
      onQuery?.(asked(request));
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      const next = index + 1 < pages.length ? String(index + 1) : null;
      return response(200).json({ items: pages[index] ?? [], next_cursor: next });
    }),
  ];
}

const anywhere = (job: JobSummary) => job.work_mode === 'remote' && job.location_key === null;

export function filtersJobs(items: JobSummary[], onQuery?: AskedQuery) {
  return [
    http.get('/v1/jobs', ({ response, query, request }) => {
      onQuery?.(asked(request));
      const keywords = query.get('q')?.toLowerCase();
      const location = query.get('location_key');
      const employmentType = query.get('employment_type');
      const workMode = query.get('work_mode');
      const matched = items.filter(
        (job) =>
          (!keywords ||
            `${job.title} ${job.location_name ?? ''}`.toLowerCase().includes(keywords)) &&
          (!location || job.location_key === location || anywhere(job)) &&
          (!employmentType || job.employment_type === employmentType) &&
          (!workMode || job.work_mode === workMode),
      );
      return response(200).json({ items: matched, next_cursor: null });
    }),
  ];
}

export function withholdsJobs() {
  return [
    http.get('/v1/jobs', async ({ response }) => {
      await delay('infinite');
      return response(200).json({ items: [], next_cursor: null });
    }),
  ];
}

export function ratelimitsJobs() {
  return [http.get('/v1/jobs', ({ response }) => response(429).json(TOO_MANY_REQUESTS))];
}

export function showsJob(job: Job) {
  return [http.get('/v1/jobs/{job_id}', ({ response }) => response(200).json(job))];
}

export function hasNoSuchJob() {
  return [http.get('/v1/jobs/{job_id}', ({ response }) => response(404).json(NO_SUCH_JOB))];
}

export function faultsOnJob(problem: Problem) {
  return [http.get('/v1/jobs/{job_id}', ({ response }) => response(500).json(problem))];
}

export function resolvesTrackedLink(job: Job, onView?: (token: string) => void) {
  return [
    http.get('/v1/jobs/by-link/{token}', ({ response, params }) => {
      onView?.(params.token);
      return response(200).json(job);
    }),
  ];
}

export function followsNoLink() {
  return [
    http.get('/v1/jobs/by-link/{token}', ({ response }) => response(404).json(DEAD_TRACKED_LINK)),
  ];
}
