import { useQueryClient } from '@tanstack/react-query';
import { TENANT_APPLICATIONS_PATH } from '@/features/applications/reread';
import { api } from '@/lib/api';
import { RECENT_APPLICATIONS } from './dashboard';

export const STATS_PATH = '/v1/tenants/me/stats';

export function tenantStats() {
  return api.queryOptions('get', STATS_PATH, {});
}

export function recentApplications() {
  return api.queryOptions('get', TENANT_APPLICATIONS_PATH, {
    params: { query: { limit: RECENT_APPLICATIONS, cursor: null, status: null, job_id: null } },
  });
}

function everyStatsReading() {
  return ['get', STATS_PATH] as const;
}

export function useRereadTenantStats() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: everyStatsReading() });
}
