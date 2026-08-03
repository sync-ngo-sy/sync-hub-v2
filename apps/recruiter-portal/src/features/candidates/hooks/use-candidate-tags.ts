import { useQueryClient } from '@tanstack/react-query';
import type { TagsWidget } from '@/features/crm/tag';
import { api } from '@/lib/api';

export const VOCABULARY_PATH = '/v1/tenants/me/tags';
export const TAGS_PATH = '/v1/tenants/me/candidates/{candidate_id}/tags';
export const TAG_PATH = '/v1/tenants/me/candidates/{candidate_id}/tags/{tag_id}';

const CANDIDATE_SCOPE = { params: { query: { scope: 'candidate' as const } } };

export function candidateVocabularyQuery() {
  return api.queryOptions('get', VOCABULARY_PATH, CANDIDATE_SCOPE);
}

export function candidateTagsQuery(candidateId: string) {
  return api.queryOptions('get', TAGS_PATH, {
    params: { path: { candidate_id: candidateId } },
  });
}

export function useCandidateTags(candidateId: string): TagsWidget {
  const queryClient = useQueryClient();

  const vocabulary = api.useQuery('get', VOCABULARY_PATH, CANDIDATE_SCOPE);
  const on = api.useQuery('get', TAGS_PATH, {
    params: { path: { candidate_id: candidateId } },
  });

  const rereadVocabulary = () =>
    queryClient.invalidateQueries({ queryKey: candidateVocabularyQuery().queryKey });
  const rereadFiling = () =>
    queryClient.invalidateQueries({ queryKey: candidateTagsQuery(candidateId).queryKey });

  const mint = api.useMutation('post', VOCABULARY_PATH, { onSuccess: rereadVocabulary });
  const put = api.useMutation('put', TAG_PATH, { onSuccess: rereadFiling });
  const take = api.useMutation('delete', TAG_PATH, { onSuccess: rereadFiling });

  const path = { candidate_id: candidateId };

  const putOn = (tagId: string) =>
    put.mutateAsync({ params: { path: { ...path, tag_id: tagId } } });

  return {
    vocabulary: vocabulary.data ?? [],
    on: on.data ?? [],
    isPending: vocabulary.isPending || on.isPending,
    isChanging: put.isPending || take.isPending || mint.isPending,
    error: on.error ?? vocabulary.error ?? null,
    refetch: () => {
      void vocabulary.refetch();
      void on.refetch();
    },
    put: putOn,
    take: (tagId) => take.mutateAsync({ params: { path: { ...path, tag_id: tagId } } }),
    create: async (name) => {
      const minted = await mint.mutateAsync({ body: { name, scope: 'candidate' } });
      await putOn(minted.id);
    },
  };
}
