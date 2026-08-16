import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { applicationQuery } from './use-application';
import { jobApplicationsQueryPrefix } from './use-job-applications';
import { matchAssessmentQueryKey } from './use-match-assessment';

export function useMoveApplication(applicationId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('patch', '/v1/tenants/me/applications/{application_id}', {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationQuery(applicationId).queryKey });
      return queryClient.invalidateQueries({ queryKey: jobApplicationsQueryPrefix() });
    },
  });
}

export function useAssessMatch(applicationId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/tenants/me/applications/{application_id}/assessment', {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: matchAssessmentQueryKey(applicationId) }),
  });
}

export function useMessageApplicant() {
  return api.useMutation('post', '/v1/tenants/me/applications/{application_id}/messages');
}
