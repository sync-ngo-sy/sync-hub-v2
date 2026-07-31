import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { cvsQueryOptions } from './use-cvs';

export function useMakeCurrentCv() {
  const queryClient = useQueryClient();
  const mutation = api.useMutation('post', '/v1/candidates/me/cvs/{cv_id}/make-current', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cvsQueryOptions.queryKey }),
  });

  function makeCurrent(cvId: string) {
    return mutation.mutateAsync({ params: { path: { cv_id: cvId } } });
  }

  return { makeCurrent, mutation };
}
