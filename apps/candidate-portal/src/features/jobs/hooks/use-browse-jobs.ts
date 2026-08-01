import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const JOBS_PAGE_SIZE = 20;

/**
 * The API's browse order is a fixed newest-first, paged by an opaque cursor with no totals —
 * so browsing can only ever be "the newest page, then the next one" (§10).
 */
export function useBrowseJobs() {
  const jobs = api.useInfiniteQuery(
    'get',
    '/v1/jobs',
    { params: { query: { limit: JOBS_PAGE_SIZE } } },
    {
      // `null`, not absent: the client drops null query params, so the first page asks for no
      // cursor at all — where the library's own default would send `cursor=0`.
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => data.pages.flatMap((page) => page.items),
    },
  );

  // The list is the whole page, so its failure is handled in place rather than by a boundary —
  // which leaves this as the one path to the reporting seam every other tier goes through (§7.2).
  const { error } = jobs;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'route', source: 'Jobs' });
  }, [error]);

  return jobs;
}
