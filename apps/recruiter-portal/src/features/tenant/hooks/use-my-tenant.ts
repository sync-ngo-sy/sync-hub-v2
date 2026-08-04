import { api } from '@/lib/api';

export function useMyTenant() {
  return api.useQuery('get', '/v1/tenants/me', {}, { throwOnError: true });
}
