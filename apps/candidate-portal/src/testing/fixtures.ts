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

const FRONTEND_DEVELOPER: components['schemas']['PublicJobSummary'] = {
  id: '00000000-0000-4000-8000-000000000101',
  title: 'Frontend Developer (Remote)',
  tenant: { name: 'Levant Digital', slug: 'levant-digital' },
  location: 'Remote',
  employment_type: 'Full-time',
  expires_at: null,
  created_at: '2026-07-29T09:00:00Z',
};

const FIELD_COORDINATOR: components['schemas']['PublicJobSummary'] = {
  id: '00000000-0000-4000-8000-000000000102',
  title: 'Field Coordinator',
  tenant: { name: 'Aman Relief', slug: 'aman-relief' },
  location: 'Aleppo',
  employment_type: 'Contract',
  expires_at: null,
  created_at: '2026-07-28T09:00:00Z',
};

const PHARMACIST: components['schemas']['PublicJobSummary'] = {
  id: '00000000-0000-4000-8000-000000000103',
  title: 'Pharmacist',
  tenant: { name: 'Sham Care', slug: 'sham-care' },
  location: null,
  employment_type: null,
  expires_at: null,
  created_at: '2026-07-27T09:00:00Z',
};

/** Newest first, as the API returns them: the third carries neither location nor type. */
export const PUBLIC_JOBS: components['schemas']['PublicJobSummary'][] = [
  FRONTEND_DEVELOPER,
  FIELD_COORDINATOR,
  PHARMACIST,
];

/** The next page the API would hand back, so Load-more has somewhere to go. */
export const MORE_PUBLIC_JOBS: components['schemas']['PublicJobSummary'][] = [
  {
    id: '00000000-0000-4000-8000-000000000104',
    title: 'Logistics Officer',
    tenant: { name: 'Aman Relief', slug: 'aman-relief' },
    location: 'Homs',
    employment_type: 'Full-time',
    expires_at: null,
    created_at: '2026-07-26T09:00:00Z',
  },
];

/** The first summary, read whole: criteria, questions and all. */
export const PUBLIC_JOB: components['schemas']['PublicJob'] = {
  ...FRONTEND_DEVELOPER,
  expires_at: '2026-09-30T09:00:00Z',
  description: 'You will own the design system.\n\nRemote from anywhere in Syria.',
  minimum_total_experience_years: 3,
  skills: [
    { name: 'TypeScript', importance: 'required', minimum_years: 3 },
    { name: 'React', importance: 'preferred', minimum_years: null },
  ],
  languages: [
    { code: 'en', minimum_proficiency: 'fluent' },
    { code: 'ar', minimum_proficiency: 'native' },
  ],
  questions: [
    {
      id: '00000000-0000-4000-8000-000000000201',
      question_text: 'Are you able to work Damascus hours?',
      question_type: 'yes_no',
      is_required: true,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      question_text: 'What is your notice period?',
      question_type: 'short_text',
      is_required: false,
    },
  ],
};

/** A Job with nothing to ask for: the criteria block has to stay off the page. */
export const BARE_PUBLIC_JOB: components['schemas']['PublicJob'] = {
  ...PHARMACIST,
  description: 'Dispensing at our Damascus branch.',
  minimum_total_experience_years: null,
  skills: [],
  languages: [],
  questions: [],
};

type Cv = components['schemas']['Cv'];

function aCv(over: Partial<Cv> & Pick<Cv, 'id' | 'display_name' | 'parsing_status'>): Cv {
  return {
    parsing_error: null,
    detected_language: null,
    is_current: false,
    created_at: '2026-07-30T09:00:00Z',
    parsed_at: null,
    ...over,
  };
}

export const CURRENT_CV = aCv({
  id: '00000000-0000-4000-8000-000000000201',
  display_name: 'lina-khoury-cv.pdf',
  parsing_status: 'ready',
  detected_language: 'en',
  is_current: true,
  parsed_at: '2026-07-30T09:01:00Z',
});

export const READY_CV = aCv({
  id: '00000000-0000-4000-8000-000000000202',
  display_name: 'lina-khoury-2024.docx',
  parsing_status: 'ready',
  detected_language: 'ar',
  created_at: '2026-07-29T09:00:00Z',
  parsed_at: '2026-07-29T09:01:00Z',
});

export const PROCESSING_CV = aCv({
  id: '00000000-0000-4000-8000-000000000203',
  display_name: 'lina-khoury-new.pdf',
  parsing_status: 'processing',
  created_at: '2026-07-31T09:00:00Z',
});

export const FAILED_CV = aCv({
  id: '00000000-0000-4000-8000-000000000204',
  display_name: 'scan.pdf',
  parsing_status: 'failed',
  parsing_error: 'This file is a scan with no text in it, so there was nothing to read.',
  created_at: '2026-07-28T09:00:00Z',
});

export const FIVE_CVS: Cv[] = [
  CURRENT_CV,
  READY_CV,
  PROCESSING_CV,
  FAILED_CV,
  aCv({
    id: '00000000-0000-4000-8000-000000000205',
    display_name: 'older.doc',
    parsing_status: 'ready',
    created_at: '2026-07-27T09:00:00Z',
    parsed_at: '2026-07-27T09:01:00Z',
  }),
];

export const DUPLICATE_CV: components['schemas']['CvConflictProblemDetail'] = {
  type: 'urn:sync:problem:duplicate-cv',
  title: 'Conflict',
  status: 409,
  detail: 'You have already uploaded this file.',
  cv_id: CURRENT_CV.id,
};

export const CV_LIMIT_REACHED: components['schemas']['CvConflictProblemDetail'] = {
  type: 'urn:sync:problem:cv-limit-reached',
  title: 'Conflict',
  status: 409,
  detail: 'You can keep 5 CVs at a time. Delete one you no longer need first.',
};

export const CV_IS_CURRENT: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:cv-is-current',
  title: 'Conflict',
  status: 409,
  detail: 'This is your current CV. Make another CV current first, then delete this one.',
};

/** The API says the same thing two ways, depending on what the unread CV was asked to do. */
export const CV_NOT_READY_FOR_DRAFT: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:cv-not-ready',
  title: 'Conflict',
  status: 409,
  detail: 'This CV has not been read yet, so there is nothing to fill a profile from.',
};

export const CV_NOT_READY_FOR_CURRENT: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:cv-not-ready',
  title: 'Conflict',
  status: 409,
  detail:
    'This CV has not been read yet, so it cannot be the current one. Wait for it to be processed, or pick one that already has been.',
};

export const EMPTY_PROFILE: components['schemas']['CandidateProfile'] = {
  full_name: 'Lina Khoury',
  is_searchable: false,
};

export const CV_DRAFT: components['schemas']['ProfileDraft'] = {
  full_name: 'Lina Khoury',
  is_searchable: false,
  headline: 'Backend engineer, 8 years',
  location: 'Aleppo, Syria',
  experiences: [
    { job_title: 'Backend engineer', company_name: 'Levant Digital', is_current: true },
  ],
  skills: [
    { name: 'Python', years_experience: 3 },
    { name: 'Kubernetes', years_experience: null },
  ],
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

export const NO_SUCH_JOB: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:job-not-found',
  title: 'Not Found',
  status: 404,
  detail: 'No published job has that id.',
};

export const DEAD_TRACKED_LINK: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tracked-link-not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This link is not one the platform will follow.',
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
