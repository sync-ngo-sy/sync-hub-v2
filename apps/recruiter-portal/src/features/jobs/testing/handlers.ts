import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { holding } from '@/testing/holding';

type JobSummary = components['schemas']['JobSummary'];
type JobView = components['schemas']['JobView'];
type NewJob = components['schemas']['NewJob'];
type ValidationProblem = components['schemas']['ValidationProblemDetail'];
type JobChanges = components['schemas']['JobChanges'];
type JobCriteria = components['schemas']['JobCriteria'];
type JobCriteriaView = components['schemas']['JobCriteriaView'];
type Problem = components['schemas']['ProblemDetail'];

const STATUSES = ['draft', 'published', 'closed', 'archived'] as const;

function statusCounts(items: JobSummary[]) {
  return STATUSES.map((status) => ({
    status,
    count: items.filter((job) => job.status === status).length,
  }));
}

function narrowed(items: JobSummary[], query: Pick<URLSearchParams, 'get'>): JobSummary[] {
  const q = query.get('q')?.trim().toLocaleLowerCase();
  const workMode = query.get('work_mode');
  return items.filter(
    (job) =>
      (!q || job.title.toLocaleLowerCase().includes(q)) &&
      (!workMode || job.work_mode === workMode),
  );
}

function listed(items: JobSummary[], query: Pick<URLSearchParams, 'get'>): JobSummary[] {
  const status = query.get('status');
  return narrowed(items, query).filter((job) => !status || job.status === status);
}

function uniqueJobs(groups: JobSummary[][]): JobSummary[] {
  return [...new Map(groups.flat().map((job) => [job.id, job])).values()];
}

export function listsJobs(items: JobSummary[]) {
  return [
    http.get('/v1/tenants/me/jobs', ({ query, response }) => {
      return response(200).json({
        items: listed(items, query),
        next_cursor: null,
        status_counts: statusCounts(narrowed(items, query)),
      });
    }),
  ];
}

export function holdsJobs(items: JobSummary[]) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get('/v1/tenants/me/jobs', async ({ query, response }) => {
        await gate.held;
        return response(200).json({
          items: listed(items, query),
          next_cursor: null,
          status_counts: statusCounts(narrowed(items, query)),
        });
      }),
    ],
  };
}

export function sortsJobs(byOrder: Record<string, JobSummary[]>, onSort?: (sort: string) => void) {
  const all = uniqueJobs(Object.values(byOrder));
  return [
    http.get('/v1/tenants/me/jobs', ({ query, response }) => {
      const sort = query.get('sort') ?? 'newest';
      onSort?.(sort);
      return response(200).json({
        items: listed(byOrder[sort] ?? [], query),
        next_cursor: null,
        status_counts: statusCounts(narrowed(all, query)),
      });
    }),
  ];
}

export function failsToListJobs(problem: Problem) {
  return [http.get('/v1/tenants/me/jobs', ({ response }) => response(500).json(problem))];
}

export function pagesJobs(pages: JobSummary[][]) {
  const all = pages.flat();
  return [
    http.get('/v1/tenants/me/jobs', ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
        status_counts: statusCounts(all),
      });
    }),
  ];
}

export function createsJob(job: JobView, onCreate?: (body: NewJob) => void) {
  return [
    http.post('/v1/tenants/me/jobs', async ({ request, response }) => {
      onCreate?.((await request.json()) as NewJob);
      return response(201).json(job);
    }),
  ];
}

export function refusesJobCreation(problem: ValidationProblem) {
  return [http.post('/v1/tenants/me/jobs', ({ response }) => response(422).json(problem))];
}

export function refusesJobEdit(problem: ValidationProblem) {
  return [
    http.patch('/v1/tenants/me/jobs/{job_id}', ({ response }) => response(422).json(problem)),
  ];
}

export function getsJob(job: JobView) {
  return [
    http.get('/v1/tenants/me/jobs/{job_id}', ({ params, response }) => {
      if (params.job_id !== job.id)
        return response(404).json({
          type: 'urn:sync:problem:not-found',
          title: 'Not found',
          status: 404,
          detail: 'This Job does not exist.',
        });
      return response(200).json(job);
    }),
  ];
}

export function holdsJob(job: JobView) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get('/v1/tenants/me/jobs/{job_id}', async ({ response }) => {
        await gate.held;
        return response(200).json(job);
      }),
    ],
  };
}

export function changesJob(job: JobView, onChange?: (body: JobChanges) => void) {
  return [
    http.patch('/v1/tenants/me/jobs/{job_id}', async ({ request, response }) => {
      onChange?.((await request.json()) as JobChanges);
      return response(200).json(job);
    }),
  ];
}

export function replacesJobCriteria(
  criteria: JobCriteriaView,
  onReplace?: (body: JobCriteria) => void,
) {
  return [
    http.put('/v1/tenants/me/jobs/{job_id}/criteria', async ({ request, response }) => {
      onReplace?.((await request.json()) as JobCriteria);
      return response(200).json(criteria);
    }),
  ];
}

export function refusesCriteriaReplacement(problem: Problem) {
  return [
    http.put('/v1/tenants/me/jobs/{job_id}/criteria', ({ response }) =>
      response(409).json(problem),
    ),
  ];
}

export function refusesJobChange(problem: Problem) {
  return [
    http.patch('/v1/tenants/me/jobs/{job_id}', ({ response }) => response(409).json(problem)),
  ];
}

export function managesJobs(initial: JobView[], onChange?: (body: JobChanges) => void) {
  let jobs = initial;
  return [
    http.get('/v1/tenants/me/jobs', ({ query, response }) => {
      return response(200).json({
        items: listed(jobs, query),
        next_cursor: null,
        status_counts: statusCounts(jobs),
      });
    }),
    http.patch('/v1/tenants/me/jobs/{job_id}', async ({ params, request, response }) => {
      const changes = (await request.json()) as JobChanges;
      onChange?.(changes);
      const current = jobs.find((job) => job.id === params.job_id);
      if (!current)
        return response(404).json({
          type: 'urn:sync:problem:not-found',
          title: 'Not found',
          status: 404,
          detail: 'This Job does not exist.',
        });
      const changed = { ...current, ...changes, updated_at: '2026-08-01T12:00:00Z' } as JobView;
      jobs = jobs.map((job) => (job.id === changed.id ? changed : job));
      return response(200).json(changed);
    }),
  ];
}
