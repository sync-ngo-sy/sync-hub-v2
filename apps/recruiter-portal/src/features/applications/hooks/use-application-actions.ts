import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { applicationQuery } from './use-application';
import { jobApplicationsQueryPrefix } from './use-job-applications';
import { matchAssessmentsQueryKey } from './use-match-assessments';

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

  return api.useMutation('post', '/v1/tenants/me/applications/{application_id}/assessments', {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: matchAssessmentsQueryKey(applicationId) }),
  });
}

export function useForgetAssessment(applicationId: string) {
  const queryClient = useQueryClient();

  return api.useMutation(
    'delete',
    '/v1/tenants/me/applications/{application_id}/assessments/{assessment_id}',
    {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: matchAssessmentsQueryKey(applicationId) }),
    },
  );
}

export function useMessageApplicant() {
  return api.useMutation('post', '/v1/tenants/me/applications/{application_id}/messages');
}
