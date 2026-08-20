import type { NotesWidget } from '@/features/crm/note';
import { api } from '@/lib/api';
import { NOTE_PATH, NOTES_PATH, useRereadApplicationNotes } from '../reread';

export const NOTES_PAGE_SIZE = 10;

function notesInit(applicationId: string) {
  return {
    params: { path: { application_id: applicationId }, query: { limit: NOTES_PAGE_SIZE } },
  };
}

export function useApplicationNotes(applicationId: string): NotesWidget {
  const notes = api.useInfiniteQuery('get', NOTES_PATH, notesInit(applicationId), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const reread = useRereadApplicationNotes(applicationId);

  const write = api.useMutation('post', NOTES_PATH, { onSuccess: reread });
  const rewrite = api.useMutation('patch', NOTE_PATH, { onSuccess: reread });
  const remove = api.useMutation('delete', NOTE_PATH, { onSuccess: reread });

  const path = { application_id: applicationId };

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
