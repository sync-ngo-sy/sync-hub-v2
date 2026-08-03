import { api } from '@/lib/api';

export const TRACKED_LINKS_PATH = '/v1/tenants/me/jobs/{job_id}/links';

export function trackedLinksQuery(jobId: string) {
  return api.queryOptions('get', TRACKED_LINKS_PATH, { params: { path: { job_id: jobId } } });
}

export function useTrackedLinks(jobId: string) {
  return api.useQuery('get', TRACKED_LINKS_PATH, { params: { path: { job_id: jobId } } });
}
