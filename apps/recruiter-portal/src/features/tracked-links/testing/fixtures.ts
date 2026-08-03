import type { TrackedLink } from '../tracked-link';

export const LINKEDIN_POST: TrackedLink = {
  id: '00000000-0000-4000-8000-000000000201',
  name: 'LinkedIn post',
  token: 'QkJ9lC3nR1sT',
  is_active: true,
  expires_at: null,
  created_at: '2026-07-20T09:00:00Z',
  view_count: 342,
};

export const WHATSAPP_GROUPS: TrackedLink = {
  id: '00000000-0000-4000-8000-000000000202',
  name: 'WhatsApp groups',
  token: 'Zx7Vb2QmN4pL',
  is_active: true,
  expires_at: null,
  created_at: '2026-07-22T09:00:00Z',
  view_count: 281,
};

export const UNIVERSITY_BOARD: TrackedLink = {
  id: '00000000-0000-4000-8000-000000000203',
  name: 'University board',
  token: 'Hf3Kd8Ws5Yt2',
  is_active: false,
  expires_at: null,
  created_at: '2026-07-24T09:00:00Z',
  view_count: 41,
};

export const NAME_TAKEN = {
  type: 'urn:sync:problem:tracked-link-name-taken',
  title: 'Conflict',
  status: 409,
  detail: 'This job already has a link called “LinkedIn post”.',
} as const;
