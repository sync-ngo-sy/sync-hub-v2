import type { components } from '@sync/api-client';
import type { JobSummary } from '@/features/jobs/job';

type TenantStats = components['schemas']['TenantStats'];

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
  application_count: 9,
  view_count: 214,
};

const NO_STAGES = {
  new: 0,
  reviewing: 0,
  shortlisted: 0,
  interview: 0,
  offer: 0,
  hired: 0,
  rejected: 0,
  withdrawn: 0,
};

const NO_VERDICTS = { pending: 0, qualified: 0, disqualified: 0, review_required: 0 };

export const NOTHING_YET: TenantStats = {
  jobs: { total: 0, draft: 0, published: 0, closed: 0, archived: 0, published_last_week: 0 },
  applications: {
    total: 0,
    last_24h: 0,
    last_7d: 0,
    previous_7d: 0,
    by_stage: NO_STAGES,
    by_qualification: NO_VERDICTS,
    pass_rate: null,
  },
  sources: [],
  sources_total: 0,
};

export const A_BUSY_WEEK: TenantStats = {
  jobs: { total: 15, draft: 3, published: 12, closed: 0, archived: 0, published_last_week: 2 },
  applications: {
    total: 120,
    last_24h: 5,
    last_7d: 47,
    previous_7d: 39,
    by_stage: { ...NO_STAGES, new: 23, reviewing: 8, shortlisted: 5, interview: 3 },
    by_qualification: { ...NO_VERDICTS, qualified: 61, disqualified: 17, pending: 42 },
    pass_rate: 78,
  },
  sources: [
    { name: 'LinkedIn post', views: 342 },
    { name: 'WhatsApp groups', views: 281 },
    { name: 'Direct', views: 190 },
    { name: 'Facebook page', views: 97 },
  ],
  sources_total: 4,
};

export function statsWith(changes: Partial<TenantStats>): TenantStats {
  return { ...A_BUSY_WEEK, ...changes };
}
