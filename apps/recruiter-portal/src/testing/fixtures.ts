import type { components } from '@sync/api-client';

export const RECRUITER: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000011',
  email: 'rana@aman.test',
  full_name: 'Rana Aljabri',
  account_type: 'recruiter',
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

export const TENANT_SIGNUP: components['schemas']['NewTenantView'] = {
  tenant: {
    id: '00000000-0000-4000-8000-000000000033',
    name: 'Aman Relief',
    slug: 'aman-relief',
  },
  admin: {
    id: RECRUITER.id,
    email: RECRUITER.email,
    full_name: RECRUITER.full_name,
    role: 'admin',
    is_active: true,
  },
};

export const EMAIL_TAKEN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:email-already-registered',
  title: 'Conflict',
  status: 409,
  detail: 'An account already exists for this email address.',
};

export const SLUG_TAKEN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tenant-slug-taken',
  title: 'Conflict',
  status: 409,
  detail: 'The address “aman-relief” is already taken. Choose another.',
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

export const LANGUAGES: components['schemas']['Language'][] = [
  { code: 'ar', name: 'Arabic' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'tr', name: 'Turkish' },
];
