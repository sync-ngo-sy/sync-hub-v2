import type { components } from '@sync/api-client';

export type JobSummary = components['schemas']['JobSummary'];
export type JobView = components['schemas']['JobView'];

export const FIELD_COORDINATOR: JobSummary = {
  id: '00000000-0000-4000-8000-000000000101',
  title: 'Field Coordinator',
  status: 'published',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  employment_type: 'full_time',
  work_mode: 'onsite',
  expires_at: null,
  created_at: '2026-07-25T09:00:00Z',
  updated_at: '2026-07-26T09:00:00Z',
  application_count: 18,
  view_count: 764,
};

export const PROGRAMME_OFFICER: JobSummary = {
  id: '00000000-0000-4000-8000-000000000102',
  title: 'Programme Officer',
  status: 'draft',
  location_key: 'sy-damascus',
  location_name: 'Damascus',
  employment_type: 'contract',
  work_mode: 'remote',
  expires_at: '2026-09-30T12:00:00Z',
  created_at: '2026-07-24T09:00:00Z',
  updated_at: '2026-07-24T09:00:00Z',
  application_count: 0,
  view_count: 0,
};

export const FIELD_COORDINATOR_VIEW: JobView = {
  ...FIELD_COORDINATOR,
  description: 'Coordinate field teams and partner delivery.',
  criteria: {
    minimum_total_experience_years: null,
    skills: [],
    languages: [],
    questions: [],
  },
  criteria_locked: false,
};

export const PROGRAMME_OFFICER_VIEW: JobView = {
  ...PROGRAMME_OFFICER,
  description: 'Lead programme planning and reporting.',
  criteria: {
    minimum_total_experience_years: null,
    skills: [],
    languages: [],
    questions: [],
  },
  criteria_locked: false,
};
