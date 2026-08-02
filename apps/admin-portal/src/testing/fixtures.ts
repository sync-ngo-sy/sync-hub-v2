import type { components } from '@sync/api-client';

export const PLATFORM_ADMIN: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000044',
  email: 'nour@sync.test',
  full_name: 'Nour Sabbagh',
  account_type: 'platform_admin',
  avatar_url: null,
  phone: null,
};

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

export const NO_SESSION: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:not-authenticated',
  title: 'Unauthorized',
  status: 401,
  detail: 'Sign in to continue.',
};
