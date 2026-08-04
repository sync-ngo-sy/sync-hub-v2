import type { TenantTrackedLink, TrackedLink } from '../tracked-link';

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

const FIELD_JOB = { id: '00000000-0000-4000-8000-000000000101', title: 'Field Coordinator' };
const MEAL_JOB = { id: '00000000-0000-4000-8000-000000000103', title: 'MEAL Officer' };

/** The same campaign run on two Jobs: two links to this page, and one channel to the Dashboard. */
export const TENANT_LINKEDIN_FIELD: TenantTrackedLink = { ...LINKEDIN_POST, job: FIELD_JOB };

export const TENANT_LINKEDIN_MEAL: TenantTrackedLink = {
  ...LINKEDIN_POST,
  id: '00000000-0000-4000-8000-000000000211',
  token: 'Rr4Tt8Yy2Uu6',
  view_count: 96,
  job: MEAL_JOB,
};

export const TENANT_WHATSAPP: TenantTrackedLink = { ...WHATSAPP_GROUPS, job: MEAL_JOB };

/** Switched off by hand: the API can narrow on this one. */
export const TENANT_UNIVERSITY_BOARD: TenantTrackedLink = { ...UNIVERSITY_BOARD, job: FIELD_JOB };

/** Still switched on, but past its date — which only the row's own `expires_at` reveals. */
export const TENANT_SPRING_CAMPAIGN: TenantTrackedLink = {
  id: '00000000-0000-4000-8000-000000000212',
  name: 'Spring campaign',
  token: 'Pp1Qq5Ss9Dd3',
  is_active: true,
  expires_at: '2026-05-01T09:00:00Z',
  created_at: '2026-03-01T09:00:00Z',
  view_count: 12,
  job: FIELD_JOB,
};

export const TENANT_LINKS = [
  TENANT_LINKEDIN_FIELD,
  TENANT_LINKEDIN_MEAL,
  TENANT_WHATSAPP,
  TENANT_UNIVERSITY_BOARD,
  TENANT_SPRING_CAMPAIGN,
];
