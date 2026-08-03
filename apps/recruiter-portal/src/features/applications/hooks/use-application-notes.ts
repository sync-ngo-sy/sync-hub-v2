import { useQueryClient } from '@tanstack/react-query';
import type { NotesWidget } from '@/features/crm/note';
import { api } from '@/lib/api';

const NOTES_PATH = '/v1/tenants/me/applications/{application_id}/notes';
const NOTE_PATH = '/v1/tenants/me/applications/{application_id}/notes/{note_id}';

export const NOTES_PAGE_SIZE = 10;

function notesInit(applicationId: string) {
  return {
    params: { path: { application_id: applicationId }, query: { limit: NOTES_PAGE_SIZE } },
  };
}

export function useApplicationNotes(applicationId: string): NotesWidget {
  const queryClient = useQueryClient();
  const init = notesInit(applicationId);

  const notes = api.useInfiniteQuery('get', NOTES_PATH, init, {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const write = api.useMutation('post', NOTES_PATH);
  const rewrite = api.useMutation('patch', NOTE_PATH);
  const erase = api.useMutation('delete', NOTE_PATH);

  const reread = () =>
    queryClient.invalidateQueries({ queryKey: api.queryOptions('get', NOTES_PATH, init).queryKey });

  const path = { application_id: applicationId };

  return {
    notes: notes.data ?? [],
    isPending: notes.isPending,
    error: notes.isError ? notes.error : null,
    refetch: () => void notes.refetch(),
    loadMore: notes.hasNextPage ? () => void notes.fetchNextPage() : null,
    isLoadingMore: notes.isFetchingNextPage,
    write: async (text) => {
      await write.mutateAsync({ params: { path }, body: { text } });
      await reread();
    },
    rewrite: async (noteId, text) => {
      await rewrite.mutateAsync({ params: { path: { ...path, note_id: noteId } }, body: { text } });
      await reread();
    },
    erase: async (noteId) => {
      await erase.mutateAsync({ params: { path: { ...path, note_id: noteId } } });
      await reread();
    },
  };
}
