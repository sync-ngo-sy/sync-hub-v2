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

/** A profile with something in every section, so a test can see all of them load. */
export const CANDIDATE_PROFILE: components['schemas']['CandidateProfile'] = {
  full_name: CANDIDATE.full_name,
  phone: '+963 11 555 0100',
  headline: 'Field coordinator, 6 years',
  summary: 'Six years of coordination work across Idlib and Aleppo.',
  location: 'Aleppo, Syria',
  preferred_language_code: 'ar',
  is_searchable: false,
  experiences: [
    {
      job_title: 'Field Coordinator',
      company_name: 'Aman Relief',
      start_year: 2020,
      start_month: 3,
      end_year: null,
      end_month: null,
      is_current: true,
      description: 'Ran distributions across three governorates.',
    },
  ],
  educations: [
    {
      institution: 'University of Aleppo',
      degree: 'BSc',
      field_of_study: 'Public Health',
      graduation_year: 2018,
      description: null,
    },
  ],
  skills: [{ name: 'Python', years_experience: 3.5 }],
  languages: [{ code: 'ar', proficiency: 'native' }],
  projects: [
    {
      name: 'Distribution tracker',
      description: null,
      project_url: 'https://tracker.example.test',
      repository_url: null,
      start_year: 2023,
      start_month: null,
      end_year: null,
      end_month: null,
    },
  ],
  unmapped_skills: ['Kobo Toolbox'],
};

export const UNKNOWN_SKILL: components['schemas']['ValidationProblemDetail'] = {
  type: 'urn:sync:problem:unknown-canonical-skill',
  title: 'Unprocessable Entity',
  status: 422,
  detail: "Every skill has to be one of the platform's Canonical skills.",
  errors: [
    {
      location: 'body.skills.0.name',
      message: '“Pythonn” is not a Canonical skill.',
      type: 'unknown_canonical_skill',
    },
  ],
};

export const SEARCHABLE_NEEDS_CV: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:searchable-needs-cv',
  title: 'Conflict',
  status: 409,
  detail: 'Upload a CV and wait for it to be processed before making your profile searchable.',
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

/** The shape of a rejection that belongs to no field the reader can see. */
export const MALFORMED_REQUEST: components['schemas']['ValidationProblemDetail'] = {
  type: 'urn:sync:problem:validation-error',
  title: 'Unprocessable Entity',
  status: 422,
  detail: 'The request did not match the expected shape.',
  errors: [
    { location: 'body.email', message: 'value is not a valid email address', type: 'value_error' },
  ],
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
