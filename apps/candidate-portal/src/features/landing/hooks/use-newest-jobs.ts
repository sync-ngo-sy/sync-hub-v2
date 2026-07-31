import { api } from '@/lib/api';

/** What the index shows before it hands the reader over to browse. */
export const NEWEST_JOBS_LIMIT = 5;

/** The API's browse order is newest-first and fixed, so the index is the first page of it. */
export function useNewestJobs() {
  return api.useQuery('get', '/v1/jobs', {
    params: { query: { limit: NEWEST_JOBS_LIMIT } },
  });
}
