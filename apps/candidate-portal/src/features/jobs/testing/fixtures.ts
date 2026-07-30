import type { components } from '@sync/api-client/schema';

type PublicJobSummary = components['schemas']['PublicJobSummary'];
type PublicJob = components['schemas']['PublicJob'];
type ProblemDetail = components['schemas']['ProblemDetail'];

const TENANT = { name: 'Damascus Tech', slug: 'damascus-tech' };

export function makeSummary(
  overrides: Partial<PublicJobSummary> & Pick<PublicJobSummary, 'id' | 'title'>,
): PublicJobSummary {
  return {
    tenant: TENANT,
    location: 'Damascus',
    employment_type: 'full_time',
    expires_at: null,
    created_at: '2026-07-30T12:00:00Z',
    ...overrides,
  };
}

export const PUBLIC_JOB: PublicJob = {
  id: 'job_1',
  title: 'Senior Frontend Engineer',
  tenant: TENANT,
  location: 'Damascus',
  employment_type: 'full_time',
  expires_at: null,
  created_at: '2026-07-30T12:00:00Z',
  description: 'Build the candidate portal with React and TypeScript.',
  minimum_total_experience_years: 5,
  skills: [
    { name: 'React', importance: 'required', minimum_years: 3 },
    { name: 'TypeScript', importance: 'preferred', minimum_years: null },
  ],
  languages: [{ code: 'en', minimum_proficiency: 'fluent' }],
  questions: [
    {
      id: 'q_1',
      question_text: 'Are you eligible to work in Syria?',
      question_type: 'yes_no',
      is_required: true,
    },
  ],
};

export function problem(status: number, title: string): ProblemDetail {
  return { type: 'about:blank', title, status };
}
