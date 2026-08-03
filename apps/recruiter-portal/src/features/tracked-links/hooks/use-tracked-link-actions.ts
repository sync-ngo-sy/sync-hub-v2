import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TRACKED_LINKS_PATH, trackedLinksQuery } from './use-tracked-links';

export function useMintTrackedLink(jobId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('post', TRACKED_LINKS_PATH, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackedLinksQuery(jobId).queryKey }),
  });
}

export function useChangeTrackedLink(jobId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('patch', '/v1/tenants/me/jobs/{job_id}/links/{link_id}', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackedLinksQuery(jobId).queryKey }),
  });
}
