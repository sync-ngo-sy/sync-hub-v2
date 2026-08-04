import { useQueryClient } from '@tanstack/react-query';
import type { NotesWidget } from '@/features/crm/note';
import { api } from '@/lib/api';

export const NOTES_PATH = '/v1/tenants/me/candidates/{candidate_id}/notes';
export const NOTE_PATH = '/v1/tenants/me/candidates/{candidate_id}/notes/{note_id}';

export const NOTES_PAGE_SIZE = 10;

function notesInit(candidateId: string) {
  return {
    params: { path: { candidate_id: candidateId }, query: { limit: NOTES_PAGE_SIZE } },
  };
}

export function candidateNotesQuery(candidateId: string) {
  return api.queryOptions('get', NOTES_PATH, notesInit(candidateId));
}

export function useCandidateNotes(candidateId: string): NotesWidget {
  const queryClient = useQueryClient();

  const notes = api.useInfiniteQuery('get', NOTES_PATH, notesInit(candidateId), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const reread = () =>
    queryClient.invalidateQueries({ queryKey: candidateNotesQuery(candidateId).queryKey });

  const write = api.useMutation('post', NOTES_PATH, { onSuccess: reread });
  const rewrite = api.useMutation('patch', NOTE_PATH, { onSuccess: reread });
  const remove = api.useMutation('delete', NOTE_PATH, { onSuccess: reread });

  const path = { candidate_id: candidateId };

  return {
    items: notes.data ?? [],
    isPending: notes.isPending,
    error: notes.isError ? notes.error : null,
    refetch: () => void notes.refetch(),
    loadMore: notes.hasNextPage ? () => void notes.fetchNextPage() : null,
    isLoadingMore: notes.isFetchingNextPage,
    write: (text) => write.mutateAsync({ params: { path }, body: { text } }),
    rewrite: (noteId, text) =>
      rewrite.mutateAsync({ params: { path: { ...path, note_id: noteId } }, body: { text } }),
    remove: (noteId) => remove.mutateAsync({ params: { path: { ...path, note_id: noteId } } }),
  };
}
