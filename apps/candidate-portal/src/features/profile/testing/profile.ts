import type { components } from '@sync/api-client/schema';

/** A full, valid profile the editor can load and round-trip in tests. */
export const CANDIDATE_PROFILE: components['schemas']['CandidateProfile'] = {
  full_name: 'Amina Haddad',
  phone: '+963 11 555 0100',
  headline: 'Backend engineer, 8 years',
  summary: 'Builds calm, dependable services.',
  location: 'Damascus, Syria',
  preferred_language_code: 'ar',
  is_searchable: false,
  experiences: [
    {
      job_title: 'Senior Engineer',
      company_name: 'Acme',
      start_year: 2019,
      start_month: 3,
      end_year: null,
      end_month: null,
      is_current: true,
      description: null,
    },
  ],
  educations: [],
  skills: [{ name: 'Python', years_experience: 5 }],
  languages: [{ code: 'ar', proficiency: 'native' }],
  projects: [],
  unmapped_skills: [],
};
