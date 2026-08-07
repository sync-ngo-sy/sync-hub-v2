import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { browseQuery, type JobFilters } from '../filters';

export const JOBS_PAGE_SIZE = 20;

export function useBrowseJobs(filters: JobFilters) {
  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/jobs',
    { params: { query: { limit: JOBS_PAGE_SIZE, ...browseQuery(filters) } } },
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
