import { api } from '../../../lib/api-client';

export function useLatestJobs() {
  return api.useQuery('get', '/v1/jobs', { params: { query: { limit: 5 } } });
}
