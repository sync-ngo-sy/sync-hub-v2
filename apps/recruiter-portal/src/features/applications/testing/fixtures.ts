import type { components } from '@sync/api-client';
import { FIELD_COORDINATOR } from '@/features/jobs/testing/fixtures';
import type { ApplicationSummary } from '../application';
import type { ApplicationReview } from '../review';

export const AMAL: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000301',
  candidate_name: 'Amal Haddad',
  headline: 'Field logistics lead',
  location: 'Aleppo',
  status: 'new',
  qualification_status: 'qualified',
  applied_at: '2026-08-02T09:00:00Z',
  updated_at: '2026-08-02T09:00:00Z',
};

export const BASSEL: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000302',
  candidate_name: 'Bassel Nasser',
  headline: null,
  location: 'Damascus',
  status: 'shortlisted',
  qualification_status: 'review_required',
  applied_at: '2026-08-01T09:00:00Z',
  updated_at: '2026-08-01T09:00:00Z',
};

export const CARLA: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000303',
  candidate_name: 'Carla Rizk',
  headline: 'Programme assistant',
  location: null,
  status: 'rejected',
  qualification_status: 'disqualified',
  applied_at: '2026-07-30T09:00:00Z',
  updated_at: '2026-07-31T09:00:00Z',
};

export const MOVE_REFUSED: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:application-transition-not-allowed',
  title: 'Conflict',
  status: 409,
  detail: 'A shortlisted application cannot become new.',
};

/** Everything a Snapshot can carry, so a test that hides a section says so by taking it away. */
export const AMAL_REVIEW: ApplicationReview = {
  id: AMAL.id,
  job: { id: FIELD_COORDINATOR.id, title: FIELD_COORDINATOR.title },
  status: 'shortlisted',
  screening: {
    status: 'qualified',
    reason: 'Meets every required skill and both languages.',
  },
  snapshot: {
    full_name: 'Amal Haddad',
    phone: '+963 11 555 0101',
    headline: 'Field logistics lead',
    summary: 'Nine years moving relief cargo across northern Syria.',
    location: 'Aleppo',
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
