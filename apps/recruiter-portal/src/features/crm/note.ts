import type { components } from '@sync/api-client';

export type Note = components['schemas']['Note'];

export interface NoteByline {
  author: string;
  at: string;
  edited: boolean;
}

export function noteByline(note: Note): NoteByline {
  const edited = note.updated_at !== note.created_at;
  return {
    author: note.author.full_name,
    at: edited ? note.updated_at : note.created_at,
    edited,
  };
}

export interface NotesWidget {
  items: Note[];
  isPending: boolean;
  error: unknown;
  refetch: () => void;
  loadMore: (() => void) | null;
  isLoadingMore: boolean;
  write: (text: string) => Promise<unknown>;
  rewrite: (noteId: string, text: string) => Promise<unknown>;
  remove: (noteId: string) => Promise<unknown>;
}
