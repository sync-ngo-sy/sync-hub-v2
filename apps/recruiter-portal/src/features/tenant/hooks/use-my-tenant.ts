import { api } from '@/lib/api';

/** The Tenant's own name is what `{{ tenant_name }}` resolves to, and nothing else this portal
 * reads carries it — so the one surface that previews a message asks for it. */
export function useMyTenant() {
  return api.useQuery('get', '/v1/tenants/me', {}, { throwOnError: true });
}
