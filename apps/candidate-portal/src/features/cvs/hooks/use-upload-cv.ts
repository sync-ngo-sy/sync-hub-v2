import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../../../lib/api-client';
import type { Cv } from '../status';
import { cvsQueryOptions } from './use-cvs';

export function useUploadCv() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<Cv> => {
      const { data, error } = await client.POST('/v1/candidates/me/cvs', {
        // The schema types the multipart file as `string`; the real payload is the File,
        // packed into FormData so the browser sets the multipart boundary.
        body: { file } as unknown as { file: string },
        bodySerializer(body) {
          const form = new FormData();
          form.append('file', (body as unknown as { file: File }).file);
          return form;
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cvsQueryOptions.queryKey }),
  });
}
