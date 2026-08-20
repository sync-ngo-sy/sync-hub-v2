import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TagScope } from './tag';

export const VOCABULARY_PATH = '/v1/tenants/me/tags';
export const VOCABULARY_TAG_PATH = '/v1/tenants/me/tags/{tag_id}';

export function wholeVocabulary() {
  return api.queryOptions('get', VOCABULARY_PATH, {});
}

export function vocabularyInScope(scope: TagScope) {
  return api.queryOptions('get', VOCABULARY_PATH, { params: { query: { scope } } });
}

function everyVocabularyReading() {
  return ['get', VOCABULARY_PATH] as const;
}

export function useRereadVocabulary() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: everyVocabularyReading() });
}
