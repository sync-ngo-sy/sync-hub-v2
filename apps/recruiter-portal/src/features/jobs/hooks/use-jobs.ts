import type { components } from '@sync/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  DEFAULT_JOB_SORT,
  type JobSort,
  type JobStatus,
  jobStatusCounts,
  type WorkMode,
} from '../job';

export const JOBS_PAGE_SIZE = 20;
type JobPage = components['schemas']['JobPage'];

export interface JobListFilters {
  status?: JobStatus;
  sort?: JobSort;
  q?: string;
  workMode?: WorkMode;
}

function pageQuery(filters: JobListFilters) {
  return {
    limit: JOBS_PAGE_SIZE,
    status: filters.status,
    sort: filters.sort ?? DEFAULT_JOB_SORT,
    q: filters.q,
    work_mode: filters.workMode,
  };
}

function jobParams(filters: JobListFilters, cursor?: string | null) {
  return { params: { query: { ...pageQuery(filters), cursor } } };
}

export function jobsQuery(filters: JobListFilters = {}) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(filters));
}

export function jobsFirstPageQuery(filters: JobListFilters = {}) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(filters, null));
}

export function jobsQueryPrefix() {
  return jobsQuery().queryKey.slice(0, 2);
}

export function useJobs(filters: JobListFilters) {
  const queryClient = useQueryClient();
  const firstPageQuery = jobsFirstPageQuery(filters);
  const firstPage = queryClient.getQueryData<JobPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/tenants/me/jobs',
    { params: { query: pageQuery(filters) } },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => ({
        items: data.pages.flatMap((page) => page.items),
        statusCounts: jobStatusCounts(data.pages[0]?.status_counts),
      }),
      initialData: firstPage ? { pages: [firstPage], pageParams: [null] } : undefined,
      initialDataUpdatedAt: firstPageUpdatedAt,
      throwOnError: true,
    },
  );

  return jobs;
}
