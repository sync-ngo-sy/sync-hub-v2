import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const NEWEST_JOBS_LIMIT = 5;

/** The API's browse order is newest-first and fixed, so the index is its first page. */
export function useNewestJobs() {
  const jobs = api.useQuery('get', '/v1/jobs', {
    params: { query: { limit: NEWEST_JOBS_LIMIT } },
  });

  // The index handles its own failure inline rather than through a boundary panel, so this is
  // where the failure reaches the reporting seam every other tier goes through (§7.2).
  const { error } = jobs;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Newest roles' });
  }, [error]);

  return jobs;
}
