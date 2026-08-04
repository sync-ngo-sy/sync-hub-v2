import type { components } from '@sync/api-client';
import type { MatchedCandidate } from '../candidate';

export const AMINA: MatchedCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  avatar_url: null,
  headline: 'Backend engineer, 8 years',
  summary: 'Builds payment systems for NGOs working across the region.',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  preferred_language_code: 'ar',
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
  matched_section: 'skills',
  matched_text: 'Triage, wound care, cold-chain handling.',
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
