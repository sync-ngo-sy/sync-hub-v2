import { useMutation } from '@tanstack/react-query';
import { client } from '@/lib/api';

export function useProfileDraft() {
  return useMutation({
    mutationFn: async (cvId: string) => {
      const { data, error } = await client.GET('/v1/candidates/me/cvs/{cv_id}/profile-draft', {
        params: { path: { cv_id: cvId } },
      });
      if (error) throw error;
      return data;
    },
  });
}
