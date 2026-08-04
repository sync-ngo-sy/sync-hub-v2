import { describe, expect, it } from 'vitest';
import { type Note, noteByline } from './note';

const NOTE: Note = {
  id: '00000000-0000-4000-8000-000000000701',
  text: 'Called her — she can start in October.',
  author: { id: '00000000-0000-4000-8000-000000000011', full_name: 'Rana Aljabri' },
  created_at: '2026-08-01T09:00:00Z',
  updated_at: '2026-08-01T09:00:00Z',
};

describe('how a note credits itself', () => {
  it('names the recruiter who wrote it and when they wrote it', () => {
    expect(noteByline(NOTE)).toEqual({
      author: 'Rana Aljabri',
      at: '2026-08-01T09:00:00Z',
      edited: false,
    });
  });

  it('dates a rewritten note by the rewrite, and says it was one', () => {
    expect(noteByline({ ...NOTE, updated_at: '2026-08-02T15:30:00Z' })).toEqual({
      author: 'Rana Aljabri',
      at: '2026-08-02T15:30:00Z',
      edited: true,
    });
  });

  it('keeps the author it was written by, whoever rewrote it', () => {
    expect(noteByline({ ...NOTE, updated_at: '2026-08-02T15:30:00Z' }).author).toBe('Rana Aljabri');
  });
});
