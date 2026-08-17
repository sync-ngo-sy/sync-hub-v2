import { api } from '@/lib/api';

export const MY_TENANT_PATH = '/v1/tenants/me';

export function myTenantQuery() {
  return api.queryOptions('get', MY_TENANT_PATH, {});
}

export function useMyTenant() {
  return api.useQuery('get', MY_TENANT_PATH, {}, { throwOnError: true });
}
