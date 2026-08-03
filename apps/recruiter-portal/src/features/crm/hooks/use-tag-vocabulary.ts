import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const VOCABULARY_PATH = '/v1/tenants/me/tags';
export const VOCABULARY_TAG_PATH = '/v1/tenants/me/tags/{tag_id}';

/**
 * The scoped read a picker makes and the whole vocabulary the settings page curates are two
 * cache entries of one path, so a word minted in either has to reach both — the key without the
 * query narrows to neither.
 */
export function everyVocabularyKey() {
  return ['get', VOCABULARY_PATH] as const;
}

export function tagVocabularyQuery() {
  return api.queryOptions('get', VOCABULARY_PATH, {});
}

export function useTagVocabulary() {
  return api.useQuery('get', VOCABULARY_PATH, {});
}

export function warmTagVocabulary(queryClient: QueryClient) {
  return queryClient.ensureQueryData(tagVocabularyQuery()).catch(() => undefined);
}

export function useRereadVocabulary() {
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
  return api.useMutation('delete', VOCABULARY_TAG_PATH, { onSuccess: reread });
}
