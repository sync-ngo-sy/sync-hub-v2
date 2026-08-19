// PROTOTYPE for #369 — throwaway. One canned parse, so a fill is visible without a real upload.

import type { ProfileDraft } from '../fill';
import type { ProfileFormValues } from '../schemas/profile';

export const STUB_CV_NAME = 'MWAFAK_ALMAHAINI_SOFTWARE_ENGINEER.pdf';

export const STUB_DRAFT: ProfileDraft = {
  full_name: 'MWAFAK ALMAHAINI',
  headline: 'Senior Software Engineer · 9 years',
  summary:
    'Backend and platform engineer. Ships Python and TypeScript services, and the infrastructure under them. Reads Arabic, English and French.',
  location_key: 'sy-damascus',
  canonical_role_key: 'backend-engineer',
  is_searchable: false,
  linkedin_url: 'https://www.linkedin.com/in/mwafak-almahaini',
  github_url: 'https://github.com/mwafak',
  portfolio_url: 'https://mwafak.dev',
  phone: '+963 (0) 944 12 34 56 ext. 2',
  phone_country: null,
  experiences: [
    {
      job_title: 'Senior Software Engineer',
      company_name: 'Orontes Systems',
      start_year: 2023,
      start_month: 4,
      end_year: null,
      end_month: null,
      is_current: true,
      description: 'Owns the billing platform and the queue that feeds it.',
    },
    {
      job_title: 'Software Engineer',
      company_name: 'Barada Labs',
      start_year: 2019,
      start_month: 8,
      end_year: 2023,
      end_month: 3,
      is_current: false,
      description: 'Built the reporting API and moved it off a nightly batch.',
    },
    {
      job_title: 'Junior Developer',
      company_name: 'Cham Interactive',
      start_year: 2017,
      start_month: 1,
      end_year: 2019,
      end_month: 7,
      is_current: false,
      description: null,
    },
  ],
  educations: [
    {
      institution: 'Damascus University',
      degree: 'BSc',
      field_of_study: 'Informatics Engineering',
      graduation_year: 2016,
      description: null,
    },
  ],
  skills: [
    { name: 'Python', years_experience: null },
    { name: 'PostgreSQL', years_experience: null },
    { name: 'Docker', years_experience: null },
    { name: 'Kubernetes', years_experience: null },
  ],
  languages: [
    { code: 'ar', proficiency: 'native' },
    { code: 'en', proficiency: 'fluent' },
    { code: 'fr', proficiency: 'intermediate' },
  ],
  projects: [
    {
      name: 'Queue drain',
      description: 'A worker that reads CVs and writes nothing until somebody says so.',
      project_url: 'https://mwafak.dev/queue-drain',
      repository_url: 'https://github.com/mwafak/queue-drain',
      start_year: 2024,
      start_month: 2,
      end_year: null,
      end_month: null,
    },
  ],
  unmapped_skills: ['Terraform', 'Grafana'],
};

export const EMPTY_VALUES: ProfileFormValues = {
  full_name: '',
  phone: '',
  phone_country: '',
  headline: '',
  summary: '',
  location_key: '',
  canonical_role_key: '',
  is_searchable: false,
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  total_experience_years: 0,
  experiences: [],
  educations: [],
  skills: [],
  languages: [],
  projects: [],
  unmapped_skills: [],
};
