import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { applicationQuery } from './use-application';
import { jobApplicationsQueryPrefix } from './use-job-applications';
import { matchAssessmentsQueryKey } from './use-match-assessments';

/** No optimistic move: the server owns which moves are legal, so the page waits for its answer
 * and re-reads the Application — the history and `updated_at` only it can write come back too. */
export function useMoveApplication(applicationId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('patch', '/v1/tenants/me/applications/{application_id}', {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationQuery(applicationId).queryKey });
      return queryClient.invalidateQueries({ queryKey: jobApplicationsQueryPrefix() });
    },
  });
}

/** No optimistic row either: an assessment is the model's words, and the list re-reads so the
 * finished one arrives where the API puts it — at the top, newest first. */
export function useAssessMatch(applicationId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/tenants/me/applications/{application_id}/assessments', {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: matchAssessmentsQueryKey(applicationId) }),
  });
}

export function useMessageApplicant(applicationId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/tenants/me/applications/{application_id}/messages', {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: applicationQuery(applicationId).queryKey }),
  });
}
