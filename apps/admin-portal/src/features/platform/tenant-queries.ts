import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PlatformTenant } from './tenant';

export const platformTenantsQuery = api.queryOptions('get', '/v1/platform/tenants');

export function useCreatePlatformTenant() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/platform/tenants', {
    onSuccess: async ({ tenant }) => {
      queryClient.setQueryData<PlatformTenant[]>(platformTenantsQuery.queryKey, (current) => {
        if (!current) return current;
        return [...current.filter(({ id }) => id !== tenant.id), tenant].sort(
          (left, right) =>
            left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug),
        );
      });
      await queryClient.invalidateQueries({ queryKey: platformTenantsQuery.queryKey });
    },
  });
}

export function useResendFoundingAdminInvite() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/platform/tenants/{tenant_id}/invite', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformTenantsQuery.queryKey }),
  });
}

export function useSetPlatformTenantStatus() {
  const queryClient = useQueryClient();

  return api.useMutation('patch', '/v1/platform/tenants/{tenant_id}', {
    onSuccess: (updated) => {
      queryClient.setQueryData<PlatformTenant[]>(platformTenantsQuery.queryKey, (current = []) =>
        current.map((tenant) => (tenant.id === updated.id ? updated : tenant)),
      );
    },
  });
}
