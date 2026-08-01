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

export const EMAIL_TAKEN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:email-already-registered',
  title: 'Conflict',
  status: 409,
  detail: 'An account already exists for this email address.',
};

export const DEAD_LINK: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:invalid-email-token',
  title: 'Bad Request',
  status: 400,
  detail: 'That link is invalid or has expired. Ask for a new one.',
};

export const WEAK_PASSWORD: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:weak-password',
  title: 'Bad Request',
  status: 400,
  detail: "That password does not meet the identity provider's requirements.",
};

export const SERVER_FAULT: components['schemas']['ProblemDetail'] = {
  type: 'about:blank',
  title: 'Internal Server Error',
  status: 500,
  detail: 'Something went wrong on our side.',
};
