import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const MY_APPLICATIONS_PAGE_SIZE = 20;

export const myApplicationsQuery = api.queryOptions('get', '/v1/applications', {
  params: { query: { limit: MY_APPLICATIONS_PAGE_SIZE } },
});

export function useMyApplications() {
  const applications = api.useInfiniteQuery(
    'get',
    '/v1/applications',
    { params: { query: { limit: MY_APPLICATIONS_PAGE_SIZE } } },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => data.pages.flatMap((page) => page.items),
    },
  );

  const { error } = applications;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Applications' });
  }, [error]);

  return applications;
}
