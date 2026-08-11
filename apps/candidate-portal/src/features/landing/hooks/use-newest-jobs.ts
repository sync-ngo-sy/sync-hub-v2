import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const NEWEST_JOBS_LIMIT = 5;

export function useNewestJobs() {
  const jobs = api.useQuery('get', '/v1/jobs', {
    params: { query: { limit: NEWEST_JOBS_LIMIT } },
  });

  const { error } = jobs;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Newest roles' });
  }, [error]);

  return jobs;
}
