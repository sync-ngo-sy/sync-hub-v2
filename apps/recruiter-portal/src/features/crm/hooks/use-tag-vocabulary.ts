import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  useRereadVocabulary,
  VOCABULARY_PATH,
  VOCABULARY_TAG_PATH,
  vocabularyInScope,
  wholeVocabulary,
} from '../reread';
import type { TagScope } from '../tag';

export function useTagVocabulary() {
  return useQuery(wholeVocabulary());
}

export function useVocabularyInScope(scope: TagScope) {
  return useQuery(vocabularyInScope(scope));
}

export function useMintTag() {
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
