import type { components } from '@sync/api-client';

export const RECRUITER: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000011',
  email: 'rana@aman.test',
  full_name: 'Rana Aljabri',
  account_type: 'recruiter',
  avatar_url: null,
  phone: null,
};

export const AMAN: components['schemas']['TenantView'] = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Aman Relief',
  slug: 'aman-relief',
};

export const CANDIDATE: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000022',
  email: 'lina@example.test',
  full_name: 'Lina Khoury',
  account_type: 'candidate',
  avatar_url: null,
  phone: null,
};

export const PLATFORM_ADMIN: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000044',
  email: 'nour@sync.test',
  full_name: 'Nour Sabbagh',
  account_type: 'platform_admin',
  avatar_url: null,
  phone: null,
};

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
  detail: 'Too many attempts. Wait a moment and try again.',
};

export const WEAK_PASSWORD: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:weak-password',
  title: 'Bad Request',
  status: 400,
  detail: "That password does not meet the identity provider's requirements.",
};

export const DEAD_LINK: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:invalid-email-token',
  title: 'Bad Request',
  status: 400,
  detail: 'That link is invalid or has expired. Ask for a new one.',
};

export const SERVER_FAULT: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:internal-error',
  title: 'Internal Server Error',
  status: 500,
  detail: 'Something went wrong on our side.',
};

export const CANONICAL_SKILLS: components['schemas']['CanonicalSkill'][] = [
  { name: 'PostgreSQL', category: 'Databases' },
  { name: 'Redis', category: 'Databases' },
  { name: 'Go', category: 'Programming Languages' },
  { name: 'Python', category: 'Programming Languages' },
];

export const LOCATIONS: components['schemas']['Location'][] = [
  { key: 'sy-aleppo', name: 'Aleppo', group: 'Syria' },
  { key: 'sy-damascus', name: 'Damascus', group: 'Syria' },
  { key: 'sy-rif-dimashq', name: 'Rif Dimashq', group: 'Syria' },
  { key: 'lb', name: 'Lebanon', group: 'Outside Syria' },
];

export const LANGUAGES: components['schemas']['Language'][] = [
  { code: 'ar', name: 'Arabic' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'tr', name: 'Turkish' },
];

export const CANONICAL_ROLES: components['schemas']['CanonicalRole'][] = [
  { key: 'backend-engineer', name: 'Backend Engineer' },
  { key: 'frontend-engineer', name: 'Frontend Engineer' },
  { key: 'nurse', name: 'Nurse' },
];
