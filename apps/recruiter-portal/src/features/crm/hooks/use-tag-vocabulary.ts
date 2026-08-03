import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const VOCABULARY_PATH = '/v1/tenants/me/tags';
export const VOCABULARY_TAG_PATH = '/v1/tenants/me/tags/{tag_id}';

export function everyVocabularyKey() {
  return ['get', VOCABULARY_PATH] as const;
}

export function useTagVocabulary() {
  return api.useQuery('get', VOCABULARY_PATH, {});
}

function useRereadVocabulary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: everyVocabularyKey() });
}

export function useCreateTag() {
  const reread = useRereadVocabulary();
  return api.useMutation('post', VOCABULARY_PATH, { onSuccess: reread });
}

export function useRenameTag() {
  const reread = useRereadVocabulary();
  return api.useMutation('patch', VOCABULARY_TAG_PATH, { onSuccess: reread });
}

export function useDeleteTag() {
  const reread = useRereadVocabulary();
  return api.useMutation('delete', VOCABULARY_TAG_PATH, { onSettled: reread });
}
