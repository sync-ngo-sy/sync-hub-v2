import type { components } from '@sync/api-client';

export const CANDIDATE: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000022',
  email: 'lina@example.test',
  full_name: 'Lina Khoury',
  account_type: 'candidate',
  avatar_url: null,
  phone: null,
};

export const RECRUITER: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000011',
  email: 'rana@aman.test',
  full_name: 'Rana Aljabri',
  account_type: 'recruiter',
  avatar_url: null,
  phone: null,
};

/** Newest first, as the API returns them: the third carries neither location nor type. */
export const PUBLIC_JOBS: components['schemas']['PublicJobSummary'][] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Frontend Developer (Remote)',
    tenant: { name: 'Levant Digital', slug: 'levant-digital' },
    location: 'Remote',
    employment_type: 'Full-time',
    expires_at: null,
    created_at: '2026-07-29T09:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    title: 'Field Coordinator',
    tenant: { name: 'Aman Relief', slug: 'aman-relief' },
    location: 'Aleppo',
    employment_type: 'Contract',
    expires_at: null,
    created_at: '2026-07-28T09:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    title: 'Pharmacist',
    tenant: { name: 'Sham Care', slug: 'sham-care' },
    location: null,
    employment_type: null,
    expires_at: null,
    created_at: '2026-07-27T09:00:00Z',
  },
];

export const NO_SESSION: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:not-authenticated',
  title: 'Unauthorized',
  status: 401,
  detail: 'Sign in to continue.',
};

export const WRONG_PASSWORD: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:invalid-credentials',
  title: 'Unauthorized',
  status: 401,
  detail: 'That email and password do not match an account.',
};

export const TOO_MANY_REQUESTS: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:rate-limited',
  title: 'Too Many Requests',
  status: 429,
  detail: 'Too many requests from this address.',
};

export const SERVER_FAULT: components['schemas']['ProblemDetail'] = {
  type: 'about:blank',
  title: 'Internal Server Error',
  status: 500,
  detail: 'Something went wrong on our side.',
};
