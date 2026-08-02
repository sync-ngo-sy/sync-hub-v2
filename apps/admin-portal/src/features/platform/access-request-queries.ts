import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { platformTenantsQuery } from './tenant-queries';

export const accessRequestsQuery = api.queryOptions('get', '/v1/platform/access-requests');

export function useConvertAccessRequest() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/platform/access-requests/{request_id}/tenant', {
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accessRequestsQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: platformTenantsQuery.queryKey }),
      ]);
    },
  });
}

export function useDismissAccessRequest() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/platform/access-requests/{request_id}/dismissal', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accessRequestsQuery.queryKey }),
  });
}
