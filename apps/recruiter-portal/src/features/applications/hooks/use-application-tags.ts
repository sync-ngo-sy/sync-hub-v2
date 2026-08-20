import { useQuery } from '@tanstack/react-query';
import { useMintTag, useVocabularyInScope } from '@/features/crm/hooks/use-tag-vocabulary';
import type { TagsWidget } from '@/features/crm/tag';
import { api } from '@/lib/api';
import { applicationTags, TAG_PATH, useRereadApplicationTags } from '../reread';

export function useApplicationTags(applicationId: string): TagsWidget {
  const vocabulary = useVocabularyInScope('application');
  const on = useQuery(applicationTags(applicationId));

  const rereadFiling = useRereadApplicationTags(applicationId);

  const mint = useMintTag();
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
