import { api } from '@/lib/api';

export function useTenantSignUp() {
  return api.useMutation('post', '/v1/tenants');
}
