import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { cvsQueryOptions } from './use-cvs';

export function useDeleteCv() {
  const queryClient = useQueryClient();
  const mutation = api.useMutation('delete', '/v1/candidates/me/cvs/{cv_id}', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cvsQueryOptions.queryKey }),
  });

  function deleteCv(cvId: string) {
    return mutation.mutateAsync({ params: { path: { cv_id: cvId } } });
  }

  return { deleteCv, mutation };
}
