import type { components } from '@sync/api-client';
import type { Cv } from '@/features/cvs/cv';
import type { Notification } from '@/features/notifications/notification';

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

export const PLATFORM_ADMIN: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000033',
  email: 'nour@sync.test',
  full_name: 'Nour Sabbagh',
  account_type: 'platform_admin',
  avatar_url: null,
  phone: null,
};

const FRONTEND_DEVELOPER: components['schemas']['PublicJobSummary'] = {
  id: '00000000-0000-4000-8000-000000000101',
  title: 'Frontend Developer (Remote)',
  tenant: { name: 'Levant Digital', slug: 'levant-digital' },
  location_key: 'sy-damascus',
  location_name: 'Damascus',
  employment_type: 'full_time',
  work_mode: 'remote',
  expires_at: null,
  created_at: '2026-07-29T09:00:00Z',
};

const FIELD_COORDINATOR: components['schemas']['PublicJobSummary'] = {
  id: '00000000-0000-4000-8000-000000000102',
  title: 'Field Coordinator',
  tenant: { name: 'Aman Relief', slug: 'aman-relief' },
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  employment_type: 'contract',
  work_mode: 'onsite',
  expires_at: null,
  created_at: '2026-07-28T09:00:00Z',
};

const PHARMACIST: components['schemas']['PublicJobSummary'] = {
  id: '00000000-0000-4000-8000-000000000103',
  title: 'Pharmacist',
  tenant: { name: 'Sham Care', slug: 'sham-care' },
  location_key: null,
  location_name: null,
  employment_type: null,
  work_mode: null,
  expires_at: null,
  created_at: '2026-07-27T09:00:00Z',
};

export const PUBLIC_JOBS: components['schemas']['PublicJobSummary'][] = [
  FRONTEND_DEVELOPER,
  FIELD_COORDINATOR,
  PHARMACIST,
];

export const MORE_PUBLIC_JOBS: components['schemas']['PublicJobSummary'][] = [
  {
    id: '00000000-0000-4000-8000-000000000104',
    title: 'Logistics Officer',
    tenant: { name: 'Aman Relief', slug: 'aman-relief' },
    location_key: 'sy-homs',
    location_name: 'Homs',
    employment_type: 'full_time',
    work_mode: 'hybrid',
    expires_at: null,
    created_at: '2026-07-26T09:00:00Z',
  },
];

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

export const BARE_PUBLIC_JOB: components['schemas']['PublicJob'] = {
  ...PHARMACIST,
  description: 'Dispensing at our Damascus branch.',
  minimum_total_experience_years: null,
  skills: [],
  languages: [],
  questions: [],
};

export const APPLICATION: components['schemas']['Application'] = {
  id: '00000000-0000-4000-8000-000000000301',
  job: {
    id: PUBLIC_JOB.id,
    title: PUBLIC_JOB.title,
    tenant: PUBLIC_JOB.tenant,
    location_key: PUBLIC_JOB.location_key,
    location_name: PUBLIC_JOB.location_name,
    employment_type: PUBLIC_JOB.employment_type,
    work_mode: PUBLIC_JOB.work_mode,
  },
  cv_id: '00000000-0000-4000-8000-000000000201',
  stage: 'received',
  can_withdraw: true,
  hire: null,
  applied_at: '2026-07-01T12:00:00Z',
  updated_at: '2026-07-01T12:00:00Z',
};

export const INTERVIEW_APPLICATION: components['schemas']['Application'] = {
  ...APPLICATION,
  id: '00000000-0000-4000-8000-000000000302',
  job: {
    id: FIELD_COORDINATOR.id,
    title: FIELD_COORDINATOR.title,
    tenant: FIELD_COORDINATOR.tenant,
    location_key: FIELD_COORDINATOR.location_key,
    location_name: FIELD_COORDINATOR.location_name,
    employment_type: FIELD_COORDINATOR.employment_type,
    work_mode: FIELD_COORDINATOR.work_mode,
  },
  stage: 'in_review',
  applied_at: '2026-06-01T12:00:00Z',
  updated_at: '2026-07-15T12:00:00Z',
};

export const CLAIMED_HIRE_APPLICATION: components['schemas']['Application'] = {
  ...INTERVIEW_APPLICATION,
  id: '00000000-0000-4000-8000-000000000304',
  stage: 'hired',
  can_withdraw: false,
  hire: {
    start_date: '2026-09-01',
    confirmation: 'unanswered',
    claimed_at: '2026-08-01T12:00:00Z',
    answered_at: null,
  },
  updated_at: '2026-08-01T12:00:00Z',
};

export const CONFIRMED_HIRE: components['schemas']['ClaimedHire'] = {
  start_date: '2026-09-01',
  confirmation: 'confirmed',
  claimed_at: '2026-08-01T12:00:00Z',
  answered_at: '2026-08-02T12:00:00Z',
};

export const MORE_APPLICATIONS: components['schemas']['Application'][] = [
  {
    ...APPLICATION,
    id: '00000000-0000-4000-8000-000000000303',
    job: {
      id: PHARMACIST.id,
      title: PHARMACIST.title,
      tenant: PHARMACIST.tenant,
      location_key: PHARMACIST.location_key,
      location_name: PHARMACIST.location_name,
      employment_type: PHARMACIST.employment_type,
      work_mode: PHARMACIST.work_mode,
    },
    stage: 'not_selected',
    can_withdraw: false,
    applied_at: '2026-05-01T12:00:00Z',
    updated_at: '2026-05-03T12:00:00Z',
  },
];

export const DUPLICATE_APPLICATION: components['schemas']['ApplicationConflictProblemDetail'] = {
  type: 'urn:sync:problem:application-already-exists',
  title: 'Conflict',
  status: 409,
  detail: 'You have already applied to this job.',
  application_id: APPLICATION.id,
};

export const APPLICATION_ANSWER_REFUSED: components['schemas']['SubmissionRefusedProblemDetail'] = {
  type: 'urn:sync:problem:invalid-application-answers',
  title: 'Unprocessable Entity',
  status: 422,
  detail: 'The answers do not match the questions this job asks.',
  errors: [
    {
      location: 'body.answers.0.answer_boolean',
      message: 'This answer no longer matches the question.',
      type: 'answer_type_mismatch',
    },
  ],
};

export const WITHDRAWAL_REFUSED: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:application-transition-not-allowed',
  title: 'Conflict',
  status: 409,
  detail: 'This application has already been decided and can no longer be withdrawn.',
};

export const HIRE_ANSWER_REFUSED: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:hire-claim-already-answered',
  title: 'Conflict',
  status: 409,
  detail: 'You have already answered this. An answer is given once and stands.',
};

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

export const CANDIDATE_PROFILE: components['schemas']['CandidateProfile'] = {
  full_name: CANDIDATE.full_name,
  phone: '+963115550100',
  phone_country: 'SY',
  headline: 'Field coordinator, 6 years',
  summary: 'Six years of coordination work across Idlib and Aleppo.',
  location_key: 'sy-aleppo',
  canonical_role_key: 'project-manager',
  is_searchable: false,
  linkedin_url: 'https://www.linkedin.com/in/lina-khoury',
  github_url: null,
  portfolio_url: 'https://lina-khoury.dev',
  total_experience_years: 6,
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

export const EMPTY_PROFILE: components['schemas']['CandidateProfile'] = {
  full_name: 'Lina Khoury',
  is_searchable: false,
  total_experience_years: 0,
};

export const CV_DRAFT: components['schemas']['ProfileDraft'] = {
  full_name: 'Lina Khoury',
  is_searchable: false,
  headline: 'Backend engineer, 8 years',
  location_key: null,
  linkedin_url: 'https://www.linkedin.com/in/lina-from-the-cv',
  github_url: 'https://github.com/lina-from-the-cv',
  experiences: [
    {
      job_title: 'Backend engineer',
      company_name: 'Levant Digital',
      start_year: 2021,
      is_current: true,
    },
  ],
  skills: [
    { name: 'Python', years_experience: 3 },
    { name: 'Kubernetes', years_experience: null },
  ],
  unmapped_skills: ['Sphere Standards'],
};

function aNotification(
  over: Partial<Notification> & Pick<Notification, 'id' | 'payload'>,
): Notification {
  return { read_at: null, created_at: '2026-07-31T09:00:00Z', ...over };
}

export const CV_FAILURE_NOTIFICATION = aNotification({
  id: '00000000-0000-4000-8000-000000000301',
  payload: {
    type: 'cv_parse_failed',
    cv_id: FAILED_CV.id,
    display_name: FAILED_CV.display_name,
  },
});

export const CV_READ_NOTIFICATION = aNotification({
  id: '00000000-0000-4000-8000-000000000305',
  payload: {
    type: 'cv_parse_succeeded',
    cv_id: READY_CV.id,
    display_name: READY_CV.display_name,
  },
});

export const MOVED_NOTIFICATION = aNotification({
  id: '00000000-0000-4000-8000-000000000302',
  created_at: '2026-07-30T09:00:00Z',
  payload: {
    type: 'application_stage_changed',
    application_id: '00000000-0000-4000-8000-000000000401',
    job_title: FRONTEND_DEVELOPER.title,
    tenant_name: FRONTEND_DEVELOPER.tenant.name,
    stage: 'in_review',
    previous_stage: 'received',
  },
});

export const READ_NOTIFICATION = aNotification({
  id: '00000000-0000-4000-8000-000000000303',
  created_at: '2026-07-29T09:00:00Z',
  read_at: '2026-07-29T10:00:00Z',
  payload: {
    type: 'application_stage_changed',
    application_id: '00000000-0000-4000-8000-000000000402',
    job_title: FIELD_COORDINATOR.title,
    tenant_name: FIELD_COORDINATOR.tenant.name,
    stage: 'not_selected',
    previous_stage: 'in_review',
  },
});

export const NOTIFICATIONS: Notification[] = [
  CV_FAILURE_NOTIFICATION,
  MOVED_NOTIFICATION,
  READ_NOTIFICATION,
];

export const MORE_NOTIFICATIONS: Notification[] = [
  aNotification({
    id: '00000000-0000-4000-8000-000000000304',
    created_at: '2026-07-28T09:00:00Z',
    payload: {
      type: 'application_stage_changed',
      application_id: '00000000-0000-4000-8000-000000000403',
      job_title: PHARMACIST.title,
      tenant_name: PHARMACIST.tenant.name,
      stage: 'hired',
      previous_stage: 'in_review',
    },
  }),
];

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

export const LOCATIONS: components['schemas']['Location'][] = [
  { key: 'sy-aleppo', name: 'Aleppo', group: 'Syria' },
  { key: 'sy-damascus', name: 'Damascus', group: 'Syria' },
  { key: 'sy-rif-dimashq', name: 'Rif Dimashq', group: 'Syria' },
  { key: 'lb', name: 'Lebanon', group: 'Outside Syria' },
];

export const CANONICAL_ROLES: components['schemas']['CanonicalRole'][] = [
  { key: 'backend-engineer', name: 'Backend Engineer' },
  { key: 'frontend-engineer', name: 'Frontend Engineer' },
  { key: 'project-manager', name: 'Project Manager' },
  { key: 'ui-ux-designer', name: 'UI/UX Designer' },
];

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

export const SEARCHABLE_NEEDS_A_COMPLETE_PROFILE: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:searchable-needs-a-complete-profile',
  title: 'Conflict',
  status: 409,
  detail:
    'Recruiters are only shown complete profiles, and only ones with a CV the platform has ' +
    'read. Yours still needs a CV that has been read and a summary. Everything else you typed ' +
    'can be saved with this switch off.',
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
