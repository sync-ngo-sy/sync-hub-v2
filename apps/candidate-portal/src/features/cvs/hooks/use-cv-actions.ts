import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, client } from '@/lib/api';
import { myCvsQuery } from './use-my-cvs';

export function useMakeCvCurrent() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/candidates/me/cvs/{cv_id}/make-current', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myCvsQuery.queryKey }),
  });
}

export function useDeleteCv() {
  const queryClient = useQueryClient();

  return api.useMutation('delete', '/v1/candidates/me/cvs/{cv_id}', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myCvsQuery.queryKey }),
  });
}

/** A command rather than a read: the link is signed and short-lived, so every click asks the
 * API for a new one instead of reusing whatever a cache is still holding. */
export function useCvDownloadLink() {
  return useMutation({
    mutationFn: async (cvId: string) => {
      const { data, error } = await client.GET('/v1/candidates/me/cvs/{cv_id}/download', {
        params: { path: { cv_id: cvId } },
      });
      if (error) throw error;
      return data;
    },
  });
}
