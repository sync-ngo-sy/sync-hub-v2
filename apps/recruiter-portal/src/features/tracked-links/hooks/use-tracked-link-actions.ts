import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TRACKED_LINK_PATH, TRACKED_LINKS_PATH, trackedLinksQuery } from './use-tracked-links';

export function useMintTrackedLink(jobId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('post', TRACKED_LINKS_PATH, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackedLinksQuery(jobId).queryKey }),
  });
}

export function useChangeTrackedLink(jobId: string) {
  const queryClient = useQueryClient();

  return api.useMutation('patch', TRACKED_LINK_PATH, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackedLinksQuery(jobId).queryKey }),
  });
}
