import { useMutation } from '@tanstack/react-query';
import { client } from '@/lib/api';

/**
 * A command rather than a read: a draft is asked for at the moment a CV is told to fill the
 * form, and holding the answer in a cache would mean a second fill from the same CV could land
 * values the API has since re-read.
 */
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
