import type { components } from '@sync/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DEFAULT_JOB_SORT, type JobSort, type JobStatus } from '../job';

export const JOBS_PAGE_SIZE = 20;
type JobPage = components['schemas']['JobPage'];

function jobParams(status?: JobStatus, sort: JobSort = DEFAULT_JOB_SORT, cursor?: string | null) {
  return { params: { query: { limit: JOBS_PAGE_SIZE, status, sort, cursor } } };
}

export function jobsQuery(status?: JobStatus, sort?: JobSort) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(status, sort));
}

export function jobsFirstPageQuery(status?: JobStatus, sort?: JobSort) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(status, sort, null));
}

export function jobsQueryPrefix() {
  return jobsQuery().queryKey.slice(0, 2);
}

export function useJobs(status?: JobStatus, sort: JobSort = DEFAULT_JOB_SORT) {
  const queryClient = useQueryClient();
  const firstPageQuery = jobsFirstPageQuery(status, sort);
  const firstPage = queryClient.getQueryData<JobPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/tenants/me/jobs',
    { params: { query: { limit: JOBS_PAGE_SIZE, status, sort } } },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => data.pages.flatMap((page) => page.items),
      initialData: firstPage ? { pages: [firstPage], pageParams: [null] } : undefined,
      initialDataUpdatedAt: firstPageUpdatedAt,
      throwOnError: true,
    },
  );

  return jobs;
}
