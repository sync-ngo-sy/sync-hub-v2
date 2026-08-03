import type { ApplicationSummary } from '@/features/applications/application';
import type { JobSummary } from '@/features/jobs/job';

/** The clock the Dashboard's counts are read against, so "this week" means one fixed week. */
export const TODAY = new Date('2026-08-04T09:00:00Z');

export const MEAL_OFFICER: JobSummary = {
  id: '00000000-0000-4000-8000-000000000103',
  title: 'MEAL Officer',
  status: 'published',
  location_key: 'sy-damascus',
  location_name: 'Damascus',
  employment_type: 'full_time',
  work_mode: 'onsite',
  expires_at: null,
  created_at: '2026-07-20T09:00:00Z',
  updated_at: '2026-07-22T09:00:00Z',
};

export const DIMA: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000311',
  candidate_name: 'Dima Sabbagh',
  headline: 'Monitoring officer',
  location: 'Damascus',
  status: 'new',
  qualification_status: 'qualified',
  applied_at: '2026-08-04T07:00:00Z',
  updated_at: '2026-08-04T07:00:00Z',
};

export const FARAH: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000312',
  candidate_name: 'Farah Doumani',
  headline: null,
  location: null,
  status: 'new',
  qualification_status: 'qualified',
  applied_at: '2026-08-03T09:00:00Z',
  updated_at: '2026-08-03T09:00:00Z',
};

export const ELIAS: ApplicationSummary = {
  id: '00000000-0000-4000-8000-000000000313',
  candidate_name: 'Elias Murad',
  headline: 'Data assistant',
  location: 'Homs',
  status: 'new',
  qualification_status: 'pending',
  applied_at: '2026-08-03T08:00:00Z',
  updated_at: '2026-08-03T08:00:00Z',
};
