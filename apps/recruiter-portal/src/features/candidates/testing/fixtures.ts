import type { components } from '@sync/api-client';
import type { MatchedCandidate, SearchableCandidate } from '../candidate';

export const AMINA: MatchedCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  avatar_url: null,
  headline: 'Backend engineer, 8 years',
  summary: 'Builds payment systems for NGOs working across the region.',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  language_names: ['Arabic', 'English'],
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
  language_names: [],
  canonical_role_key: null,
  canonical_role_name: null,
  total_experience_years: 3,
  in_talent_pool: false,
  matched_section: 'skills',
  matched_text: 'Triage, wound care, cold-chain handling.',
};

/** The directory answers with the same person, minus the fragment that only a ranking has. */
export const LISTED_AMINA: SearchableCandidate = {
  candidate_id: AMINA.candidate_id,
  full_name: 'Amina Haddad',
  avatar_url: null,
  headline: 'Backend engineer, 8 years',
  summary: AMINA.summary,
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  language_names: ['Arabic', 'English'],
  canonical_role_key: 'backend-engineer',
  canonical_role_name: 'Backend Engineer',
  total_experience_years: 8,
  in_talent_pool: false,
};

export const LISTED_YOUSSEF: SearchableCandidate = {
  candidate_id: YOUSSEF.candidate_id,
  full_name: 'Youssef Nassar',
  avatar_url: null,
  headline: 'Site nurse',
  summary: null,
  location_key: 'sy-damascus',
  location_name: 'Damascus',
  language_names: [],
  canonical_role_key: 'nurse',
  canonical_role_name: 'Nurse',
  total_experience_years: 3,
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
