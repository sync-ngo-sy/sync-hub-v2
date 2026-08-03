import { useQueryClient } from '@tanstack/react-query';
import type { TagsWidget } from '@/features/crm/tag';
import { api } from '@/lib/api';

export const VOCABULARY_PATH = '/v1/tenants/me/tags';
export const TAGS_PATH = '/v1/tenants/me/applications/{application_id}/tags';
export const TAG_PATH = '/v1/tenants/me/applications/{application_id}/tags/{tag_id}';

const APPLICATION_SCOPE = { params: { query: { scope: 'application' as const } } };

export function applicationVocabularyQuery() {
  return api.queryOptions('get', VOCABULARY_PATH, APPLICATION_SCOPE);
}

export function applicationTagsQuery(applicationId: string) {
  return api.queryOptions('get', TAGS_PATH, {
    params: { path: { application_id: applicationId } },
  });
}

export function useApplicationTags(applicationId: string): TagsWidget {
  const queryClient = useQueryClient();

  const vocabulary = api.useQuery('get', VOCABULARY_PATH, APPLICATION_SCOPE);
  const on = api.useQuery('get', TAGS_PATH, {
    params: { path: { application_id: applicationId } },
  });

  const rereadVocabulary = () =>
    queryClient.invalidateQueries({ queryKey: applicationVocabularyQuery().queryKey });
  const rereadFiling = () =>
    queryClient.invalidateQueries({ queryKey: applicationTagsQuery(applicationId).queryKey });

  const mint = api.useMutation('post', VOCABULARY_PATH, { onSuccess: rereadVocabulary });
  const put = api.useMutation('put', TAG_PATH, { onSuccess: rereadFiling });
  const take = api.useMutation('delete', TAG_PATH, { onSuccess: rereadFiling });

  const path = { application_id: applicationId };

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
      const minted = await mint.mutateAsync({ body: { name, scope: 'application' } });
      await putOn(minted.id);
    },
  };
}
