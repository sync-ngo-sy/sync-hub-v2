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

/**
 * Cursor-paged, one page per array: the handler answers whichever page the `cursor` it was
 * given names, so Load-more is exercised through the same round-trip the API asks for.
 */
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

export function filtersJobs(items: JobSummary[], onQuery?: AskedQuery) {
  return [
    http.get('/v1/jobs', ({ response, query, request }) => {
      onQuery?.(asked(request));
      const keywords = query.get('q')?.toLowerCase();
      const location = query.get('location_key');
      const employmentType = query.get('employment_type');
      const matched = items.filter(
        (job) =>
          (!keywords ||
            `${job.title} ${job.location_name ?? ''}`.toLowerCase().includes(keywords)) &&
          (!location || job.location_key === location) &&
          (!employmentType || job.employment_type === employmentType),
      );
      return response(200).json({ items: matched, next_cursor: null });
    }),
  ];
}

/** Never answers, so the pending list can be looked at. */
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

/** The `onView` spy is how a test proves the API counted the arrival, not the page. */
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
