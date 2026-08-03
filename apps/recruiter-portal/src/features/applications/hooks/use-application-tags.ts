import { useQueryClient } from '@tanstack/react-query';
import type { TagsWidget } from '@/features/crm/tag';
import { api } from '@/lib/api';

const VOCABULARY_PATH = '/v1/tenants/me/tags';
const TAGS_PATH = '/v1/tenants/me/applications/{application_id}/tags';
const TAG_PATH = '/v1/tenants/me/applications/{application_id}/tags/{tag_id}';

const APPLICATION_SCOPE = { params: { query: { scope: 'application' as const } } };

export function useApplicationTags(applicationId: string): TagsWidget {
  const queryClient = useQueryClient();
  const init = { params: { path: { application_id: applicationId } } };

  const vocabulary = api.useQuery('get', VOCABULARY_PATH, APPLICATION_SCOPE);
  const on = api.useQuery('get', TAGS_PATH, init);

  const create = api.useMutation('post', VOCABULARY_PATH);
  const put = api.useMutation('put', TAG_PATH);
  const take = api.useMutation('delete', TAG_PATH);

  const reread = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: api.queryOptions('get', VOCABULARY_PATH, APPLICATION_SCOPE).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: api.queryOptions('get', TAGS_PATH, init).queryKey,
      }),
    ]);

  const path = { application_id: applicationId };

  const putOn = async (tagId: string) => {
    await put.mutateAsync({ params: { path: { ...path, tag_id: tagId } } });
    await reread();
  };

  return {
    vocabulary: vocabulary.data ?? [],
    on: on.data ?? [],
    isPending: vocabulary.isPending || on.isPending,
    error: on.error ?? vocabulary.error ?? null,
    refetch: () => {
      void vocabulary.refetch();
      void on.refetch();
    },
    put: putOn,
    take: async (tagId) => {
      await take.mutateAsync({ params: { path: { ...path, tag_id: tagId } } });
      await reread();
    },
    create: async (name) => {
      const minted = await create.mutateAsync({ body: { name, scope: 'application' } });
      await putOn(minted.id);
    },
  };
}
