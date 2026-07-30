import { api } from '@/lib/api';

/** The Tenant the signed-in Recruiter works for — the workspace name the chrome shows. */
export function useMyTenant() {
  return api.useQuery('get', '/v1/tenants/me');
}
