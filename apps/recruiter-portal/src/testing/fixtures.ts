import type { components } from '@sync/api-client/schema';

export const RECRUITER: components['schemas']['ProfileView'] = {
  id: 'p_recruiter',
  email: 'rana@aman.test',
  full_name: 'Rana Aljabri',
  account_type: 'recruiter',
  avatar_url: null,
  phone: null,
};

export const CANDIDATE: components['schemas']['ProfileView'] = {
  ...RECRUITER,
  id: 'p_candidate',
  email: 'lina@example.test',
  full_name: 'Lina Khoury',
  account_type: 'candidate',
};

export const TENANT: components['schemas']['TenantView'] = {
  id: 't_aman',
  name: 'Aman Relief',
  slug: 'aman-relief',
};

export function problem(status: number, title: string): components['schemas']['ProblemDetail'] {
  return { type: 'about:blank', title, status };
}
