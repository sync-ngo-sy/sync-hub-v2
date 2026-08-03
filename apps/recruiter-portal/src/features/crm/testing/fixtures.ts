import type { components } from '@sync/api-client';
import type { Note } from '../note';
import type { Tag } from '../tag';

export const CALLED_HER: Note = {
  id: '00000000-0000-4000-8000-000000000701',
  text: 'Called her — she can start in October, and she has her own vehicle.',
  author: { id: '00000000-0000-4000-8000-000000000011', full_name: 'Rana Aljabri' },
  created_at: '2026-08-02T15:00:00Z',
  updated_at: '2026-08-02T15:00:00Z',
};

export const REFERENCE_CHECKED: Note = {
  id: '00000000-0000-4000-8000-000000000702',
  text: 'Hand in Hand confirmed the dates on her CV.',
  author: { id: '00000000-0000-4000-8000-000000000012', full_name: 'Omar Zayed' },
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T11:30:00Z',
};

export const ARABIC: Tag = {
  id: '00000000-0000-4000-8000-000000000801',
  name: 'Arabic',
  scope: 'application',
  created_at: '2026-07-01T09:00:00Z',
};

export const HAS_A_LICENCE: Tag = {
  id: '00000000-0000-4000-8000-000000000802',
  name: 'Has a driving licence',
  scope: 'application',
  created_at: '2026-07-01T09:00:00Z',
};

export const RELOCATING: Tag = {
  id: '00000000-0000-4000-8000-000000000803',
  name: 'Relocating',
  scope: 'application',
  created_at: '2026-07-02T09:00:00Z',
};

export const OPEN_TO_RELOCATION: Tag = {
  id: '00000000-0000-4000-8000-000000000804',
  name: 'Open to relocation',
  scope: 'candidate',
  created_at: '2026-07-02T09:00:00Z',
};

export const TAG_NAME_TAKEN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tag-name-taken',
  title: 'Conflict',
  status: 409,
  detail: 'This tenant already has a tag called “Kurdish” in that scope.',
};

export const TAG_WRONG_SCOPE: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tag-scope-mismatch',
  title: 'Conflict',
  status: 409,
  detail: 'That Tag is candidate-scoped and cannot go on an Application.',
};
