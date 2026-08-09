import type { components } from '@sync/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DEFAULT_JOB_SORT, type JobSort, type JobStatus, jobStatusCounts } from '../job';

export const JOBS_PAGE_SIZE = 20;
type JobPage = components['schemas']['JobPage'];

function jobParams(
  status?: JobStatus,
  sort: JobSort = DEFAULT_JOB_SORT,
  q?: string,
  cursor?: string | null,
) {
  return { params: { query: { limit: JOBS_PAGE_SIZE, status, sort, q, cursor } } };
}

export function jobsQuery(status?: JobStatus, sort?: JobSort, q?: string) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(status, sort, q));
}

export function jobsFirstPageQuery(status?: JobStatus, sort?: JobSort, q?: string) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(status, sort, q, null));
}

export function jobsQueryPrefix() {
  return jobsQuery().queryKey.slice(0, 2);
}

export function useJobs(status?: JobStatus, sort: JobSort = DEFAULT_JOB_SORT, q?: string) {
  const queryClient = useQueryClient();
  const firstPageQuery = jobsFirstPageQuery(status, sort, q);
  const firstPage = queryClient.getQueryData<JobPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/tenants/me/jobs',
    { params: { query: { limit: JOBS_PAGE_SIZE, status, sort, q } } },
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
