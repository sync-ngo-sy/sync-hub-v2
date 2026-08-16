import type { components } from '@sync/api-client';
import { FIELD_COORDINATOR } from '@/features/jobs/testing/fixtures';
import type { ApplicationJob, ApplicationSummary, TenantApplication } from '../application';
import type { MatchAssessment, MatchScore } from '../assessment';
import type { ApplicationReview } from '../review';

export const FIELD: ApplicationJob = {
  id: FIELD_COORDINATOR.id,
  title: FIELD_COORDINATOR.title,
  location_name: FIELD_COORDINATOR.location_name,
};

export const MEAL: ApplicationJob = {
  id: '00000000-0000-4000-8000-000000000103',
  title: 'MEAL Officer',
  location_name: 'Damascus',
};

export const DIMA: TenantApplication = {
  id: '00000000-0000-4000-8000-000000000311',
  candidate_name: 'Dima Sabbagh',
  headline: 'Monitoring officer',
  location: 'Damascus',
  canonical_role: 'MEAL Officer',
  total_experience_years: 6,
  status: 'new',
  qualification_status: 'qualified',
  applied_at: '2026-08-04T07:00:00Z',
  updated_at: '2026-08-04T07:00:00Z',
  job: MEAL,
};

export const FARAH: TenantApplication = {
  id: '00000000-0000-4000-8000-000000000312',
  candidate_name: 'Farah Doumani',
  headline: null,
  location: null,
  canonical_role: null,
  total_experience_years: 0,
  status: 'new',
  qualification_status: 'qualified',
  applied_at: '2026-08-03T09:00:00Z',
  updated_at: '2026-08-03T09:00:00Z',
  job: FIELD,
};

export const ELIAS: TenantApplication = {
  id: '00000000-0000-4000-8000-000000000313',
  candidate_name: 'Elias Murad',
  headline: 'Data assistant',
  location: 'Homs',
  canonical_role: 'Data Analyst',
  total_experience_years: 1,
  status: 'reviewing',
  qualification_status: 'pending',
  applied_at: '2026-08-03T08:00:00Z',
  updated_at: '2026-08-03T08:00:00Z',
  job: MEAL,
};

export const GHADA: TenantApplication = {
  id: '00000000-0000-4000-8000-000000000314',
  candidate_name: 'Ghada Kanaan',
  headline: 'Warehouse supervisor',
  location: 'Latakia',
  canonical_role: 'Warehouse Manager',
  total_experience_years: 11,
  status: 'rejected',
  qualification_status: 'disqualified',
  applied_at: '2026-08-02T09:00:00Z',
  updated_at: '2026-08-05T09:00:00Z',
  job: FIELD,
};

export const HANI: TenantApplication = {
  id: '00000000-0000-4000-8000-000000000315',
  candidate_name: 'Hani Barakat',
  headline: 'Cash programming officer',
  location: 'Homs',
  canonical_role: 'Programme Officer',
  total_experience_years: 8,
  status: 'hired',
  qualification_status: 'qualified',
  applied_at: '2026-06-01T09:00:00Z',
  updated_at: '2026-06-20T09:00:00Z',
  job: MEAL,
};

export const AMAL_MATCH: MatchScore = {
  percentage: 82,
  explanation: 'Nine years of field logistics against a role asking for five, and both languages.',
  model_name: 'gpt-4o-mini',
  assessed_at: '2026-08-02T09:02:00Z',
};

export const AMAL: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000301',
  candidate_name: 'Amal Haddad',
  headline: 'Field logistics lead',
  location: 'Aleppo',
  canonical_role: 'Logistics Manager',
  total_experience_years: 9,
  status: 'new',
  qualification_status: 'qualified',
  match: AMAL_MATCH,
  applied_at: '2026-08-02T09:00:00Z',
  updated_at: '2026-08-02T09:00:00Z',
};

export const BASSEL: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000302',
  candidate_name: 'Bassel Nasser',
  headline: null,
  location: 'Damascus',
  canonical_role: null,
  total_experience_years: 4,
  status: 'shortlisted',
  qualification_status: 'review_required',
  match: {
    percentage: 41,
    explanation: null,
    model_name: 'gpt-4o-mini',
    assessed_at: '2026-08-01T09:03:00Z',
  },
  applied_at: '2026-08-01T09:00:00Z',
  updated_at: '2026-08-01T09:00:00Z',
};

export const CARLA: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000303',
  candidate_name: 'Carla Rizk',
  headline: 'Programme assistant',
  location: null,
  canonical_role: 'Programme Assistant',
  total_experience_years: 2,
  status: 'rejected',
  qualification_status: 'disqualified',
  match: null,
  applied_at: '2026-07-30T09:00:00Z',
  updated_at: '2026-07-31T09:00:00Z',
};

export const MOVE_REFUSED: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:application-transition-not-allowed',
  title: 'Conflict',
  status: 409,
  detail: 'A shortlisted application cannot become new.',
};

export const AMAL_REVIEW: ApplicationReview = {
  id: AMAL.id,
  job: { id: FIELD_COORDINATOR.id, title: FIELD_COORDINATOR.title },
  candidate: {
    id: '00000000-0000-4000-8000-000000000041',
    email: 'amal.haddad@example.test',
    avatar_url: null,
  },
  status: 'shortlisted',
  screening: {
    status: 'qualified',
    reason: null,
  },
  snapshot: {
    full_name: 'Amal Haddad',
    phone: '+963115550101',
    phone_country: 'SY',
    headline: 'Field logistics lead',
    total_experience_years: 9,
    summary: 'Nine years moving relief cargo across northern Syria.',
    location: 'Aleppo',
    canonical_role: 'Logistics Manager',
    linkedin_url: 'https://www.linkedin.com/in/amal-haddad',
    portfolio_url: 'https://amal-haddad.dev',
    unmapped_skills: ['Convoy planning', 'Customs clearance'],
    experiences: [
      {
        job_title: 'Logistics Coordinator',
        company_name: 'Hand in Hand',
        start_year: 2022,
        start_month: 3,
        end_year: null,
        end_month: null,
        is_current: true,
        description: 'Runs the Aleppo warehouse and its four field routes.',
      },
      {
        job_title: 'Warehouse Officer',
        company_name: 'Syria Relief',
        start_year: 2018,
        start_month: 1,
        end_year: 2022,
        end_month: 2,
        is_current: false,
        description: null,
      },
    ],
    educations: [
      {
        institution: 'University of Aleppo',
        degree: 'BSc',
        field_of_study: 'Civil Engineering',
        graduation_year: 2017,
        description: null,
      },
    ],
    skills: [
      { name: 'PostgreSQL', years_experience: 3 },
      { name: 'Python', years_experience: 1 },
    ],
    languages: [
      { code: 'ar', proficiency: 'native' },
      { code: 'en', proficiency: 'advanced' },
    ],
    projects: [
      {
        name: 'Cold-chain pilot',
        description: 'Kept vaccines viable on a twelve-hour route.',
        project_url: 'https://example.test/cold-chain',
        repository_url: 'https://example.test/cold-chain-repo',
        start_year: 2024,
        start_month: 6,
        end_year: 2024,
        end_month: 11,
      },
    ],
  },
  answers: [
    {
      question_id: '00000000-0000-4000-8000-000000000401',
      question_text: 'Do you hold a valid driving licence?',
      question_type: 'yes_no',
      answer_boolean: true,
      answer_text: null,
    },
    {
      question_id: '00000000-0000-4000-8000-000000000402',
      question_text: 'Which governorates can you reach within a day?',
      question_type: 'short_text',
      answer_boolean: null,
      answer_text: 'Aleppo, Idlib and Hama.',
    },
  ],
  history: [
    { status: 'new', previous_status: null, source: 'candidate', changed_at: AMAL.applied_at },
    {
      status: 'reviewing',
      previous_status: 'new',
      source: 'recruiter',
      changed_at: '2026-08-02T11:00:00Z',
    },
    {
      status: 'shortlisted',
      previous_status: 'reviewing',
      source: 'recruiter',
      changed_at: '2026-08-02T14:30:00Z',
    },
  ],
  cv: {
    id: '00000000-0000-4000-8000-000000000501',
    display_name: 'amal-haddad-cv.pdf',
    download_url: 'https://files.sync.test/amal-haddad-cv.pdf?sig=short-lived',
    expires_in_seconds: 900,
  },
  applied_at: AMAL.applied_at,
  updated_at: '2026-08-02T14:30:00Z',
};

export const LATEST_ASSESSMENT: MatchAssessment = {
  id: '00000000-0000-4000-8000-000000000601',
  is_current: true,
  match_percentage: 82,
  explanation: 'Answers both languages and most of the required skills.',
  strengths: ['Nine years of field logistics', 'Native Arabic and advanced English'],
  gaps: ['No formal procurement training'],
  model_name: 'claude-sonnet-5',
  prompt_version: 'v3',
  assessed_at: '2026-08-03T09:00:00Z',
};

export const EARLIER_ASSESSMENT: MatchAssessment = {
  id: '00000000-0000-4000-8000-000000000602',
  is_current: false,
  match_percentage: 54,
  explanation: 'Reads as a warehouse profile rather than a coordination one.',
  strengths: ['Warehouse operations'],
  gaps: ['Little evidence of coordinating across sites', 'No budget ownership'],
  model_name: 'claude-sonnet-5',
  prompt_version: 'v2',
  assessed_at: '2026-07-28T09:00:00Z',
};

export const BARE_ASSESSMENT: MatchAssessment = {
  id: '00000000-0000-4000-8000-000000000603',
  is_current: false,
  match_percentage: 40,
  explanation: null,
  strengths: [],
  gaps: [],
  model_name: 'claude-sonnet-5',
  prompt_version: 'v3',
  assessed_at: '2026-07-20T09:00:00Z',
};

export const TOO_MANY_ASSESSMENTS: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:rate-limited',
  title: 'Too Many Requests',
  status: 429,
  detail: 'This tenant has asked for too many assessments. Try again in a few minutes.',
};

export const MODEL_COULD_NOT_ASSESS: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:assessment-failed',
  title: 'Bad Gateway',
  status: 502,
  detail: 'The model could not assess this Application. Nothing was recorded.',
};

export const NO_ASSESSMENT_MODEL: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:assessment-unavailable',
  title: 'Service Unavailable',
  status: 503,
  detail: 'This deployment has no assessment model configured.',
};

export const QUEUED_MESSAGE: components['schemas']['QueuedMessage'] = {
  id: '00000000-0000-4000-8000-000000000701',
  subject: 'An interview for Field Coordinator?',
  body: 'Hi Amal Haddad,\n\nWe would like to talk to you about Field Coordinator.\n\nAman Relief',
  status: 'queued',
  created_at: '2026-08-03T10:00:00Z',
};

export const NO_SUCH_TEMPLATE_TO_SEND: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no message template with that id.',
};
