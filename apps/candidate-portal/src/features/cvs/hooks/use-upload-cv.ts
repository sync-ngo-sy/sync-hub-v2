import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { myCvsQuery } from './use-my-cvs';

export function cvUpload(file: File) {
  return {
    body: { file: file.name },
    bodySerializer: () => {
      const form = new FormData();
      form.set('file', file);
      return form;
    },
  };
}

export function useUploadCv() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/candidates/me/cvs', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myCvsQuery.queryKey }),
  });
}
