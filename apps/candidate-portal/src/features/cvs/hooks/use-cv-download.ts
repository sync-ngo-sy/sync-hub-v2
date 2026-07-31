import { useMutation } from '@tanstack/react-query';
import { client } from '../../../lib/api-client';

export function useCvDownload() {
  const mutation = useMutation({
    mutationFn: async (cvId: string): Promise<string> => {
      const { data, error } = await client.GET('/v1/candidates/me/cvs/{cv_id}/download', {
        params: { path: { cv_id: cvId } },
      });
      if (error) throw error;
      return data.url;
    },
    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  });

  function download(cvId: string) {
    return mutation.mutateAsync(cvId);
  }

  return { download, mutation };
}
