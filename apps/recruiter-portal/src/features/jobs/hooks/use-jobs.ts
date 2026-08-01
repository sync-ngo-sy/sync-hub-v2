import type { components } from '@sync/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JobStatus } from '../job';

export const JOBS_PAGE_SIZE = 20;
type JobPage = components['schemas']['JobPage'];

function jobParams(status?: JobStatus, cursor?: string | null) {
  return { params: { query: { limit: JOBS_PAGE_SIZE, status, cursor } } };
}

export function jobsQuery(status?: JobStatus) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(status));
}

export function jobsFirstPageQuery(status?: JobStatus) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', jobParams(status, null));
}

export function jobsQueryPrefix() {
  return jobsQuery().queryKey.slice(0, 2);
}

export function useJobs(status?: JobStatus) {
  const queryClient = useQueryClient();
  const firstPageQuery = jobsFirstPageQuery(status);
  const firstPage = queryClient.getQueryData<JobPage>(firstPageQuery.queryKey);
  const firstPageUpdatedAt = queryClient.getQueryState(firstPageQuery.queryKey)?.dataUpdatedAt;

  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/tenants/me/jobs',
    { params: { query: { limit: JOBS_PAGE_SIZE, status } } },
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
