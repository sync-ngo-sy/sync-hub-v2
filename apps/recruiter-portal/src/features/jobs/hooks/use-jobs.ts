import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import type { JobStatus } from '../job';

export const JOBS_PAGE_SIZE = 20;

export function jobsQuery(status?: JobStatus) {
  return api.queryOptions('get', '/v1/tenants/me/jobs', {
    params: { query: { limit: JOBS_PAGE_SIZE, status } },
  });
}

export function useJobs(status?: JobStatus) {
  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/tenants/me/jobs',
    { params: { query: { limit: JOBS_PAGE_SIZE, status } } },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => data.pages.flatMap((page) => page.items),
    },
  );

  const { error } = jobs;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Jobs' });
  }, [error]);

  return jobs;
}
