import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { applicationQuery } from './use-application';
import { jobApplicationsQueryPrefix } from './use-job-applications';

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
