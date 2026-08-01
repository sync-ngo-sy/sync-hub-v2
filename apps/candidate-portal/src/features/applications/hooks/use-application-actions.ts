import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { myApplicationsQuery } from './use-my-applications';

export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/applications', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myApplicationsQuery.queryKey }),
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/applications/{application_id}/withdraw', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myApplicationsQuery.queryKey }),
  });
}
