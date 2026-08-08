import type { components } from '@sync/api-client';
import type { MatchedCandidate } from '../candidate';
import type { CandidateRecord } from '../candidate-record';

export const AMINA: MatchedCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  avatar_url: null,
  headline: 'Backend engineer, 8 years',
  summary: 'Builds payment systems for NGOs working across the region.',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  preferred_language_code: 'ar',
  canonical_role_key: 'backend-engineer',
  canonical_role_name: 'Backend Engineer',
  total_experience_years: 8,
  in_talent_pool: false,
  matched_section: 'experience',
  matched_text: 'Ran the payment platform at Hand in Hand for four years.',
};

export const YOUSSEF: MatchedCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000032',
  full_name: 'Youssef Nassar',
  avatar_url: null,
  headline: 'Site nurse',
  summary: null,
  location_key: 'sy-damascus',
  location_name: 'Damascus',
  preferred_language_code: 'en',
  canonical_role_key: null,
  canonical_role_name: null,
  total_experience_years: 3,
  in_talent_pool: false,
  matched_section: 'skills',
  matched_text: 'Triage, wound care, cold-chain handling.',
};

export const AMINA_RECORD: CandidateRecord = {
  candidate_id: AMINA.candidate_id,
  full_name: 'Amina Haddad',
  avatar_url: null,
  headline: 'Backend engineer, 8 years',
  summary: 'Builds payment systems for NGOs working across the region.',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  canonical_role_key: 'backend-engineer',
  canonical_role_name: 'Backend Engineer',
  total_experience_years: 8,
  preferred_language_code: 'ar',
  in_talent_pool: false,
  phone: '+963 11 555 0142',
  email: 'amina.haddad@example.test',
  experiences: [
    {
      job_title: 'Payments Lead',
      company_name: 'Hand in Hand',
      start_year: 2021,
      start_month: 4,
      end_year: null,
      end_month: null,
      is_current: true,
      description: 'Ran the payment platform for four years.',
    },
  ],
  educations: [
    {
      institution: 'University of Aleppo',
      degree: 'BSc',
      field_of_study: 'Computer Science',
      graduation_year: 2016,
      description: null,
    },
  ],
  skills: [{ name: 'PostgreSQL', years_experience: 6 }],
  languages: [
    { code: 'ar', proficiency: 'native' },
    { code: 'en', proficiency: 'advanced' },
  ],
  projects: [
    {
      name: 'Cash transfer ledger',
      description: 'An offline-first ledger for field disbursements.',
      project_url: 'https://example.test/ledger',
      repository_url: null,
      start_year: 2023,
      start_month: 2,
      end_year: 2023,
      end_month: 9,
    },
  ],
};

export const BARE_RECORD: CandidateRecord = {
  candidate_id: AMINA.candidate_id,
  full_name: 'Amina Haddad',
  total_experience_years: 0,
  in_talent_pool: false,
};

export const SEARCH_OFFLINE: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:search-unavailable',
  title: 'Service Unavailable',
  status: 503,
  detail: 'Global search is not configured on this deployment.',
};

export const CANDIDATE_OUT_OF_REACH: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'That candidate is not searchable, or no longer exists.',
};
