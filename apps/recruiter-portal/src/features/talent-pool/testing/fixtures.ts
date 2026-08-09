import { AMINA, YOUSSEF } from '@/features/candidates/testing/fixtures';
import type { PooledCandidate } from '../pool';

export const AMINA_SAVED: PooledCandidate = {
  candidate_id: AMINA.candidate_id,
  full_name: 'Amina Haddad',
  avatar_url: 'https://cdn.example.test/amina.webp',
  headline: 'Backend engineer, 8 years',
  location_name: 'Aleppo',
  canonical_role_name: 'Backend Engineer',
  total_experience_years: 8,
  tags: [
    {
      id: '00000000-0000-4000-8000-0000000000a1',
      name: 'Arabic speaker',
      scope: 'candidate',
      created_at: '2026-07-01T09:00:00Z',
    },
    {
      id: '00000000-0000-4000-8000-0000000000a2',
      name: 'Interviewed',
      scope: 'candidate',
      created_at: '2026-07-01T09:00:00Z',
    },
    {
      id: '00000000-0000-4000-8000-0000000000a3',
      name: 'Referred',
      scope: 'candidate',
      created_at: '2026-07-01T09:00:00Z',
    },
    {
      id: '00000000-0000-4000-8000-0000000000a4',
      name: 'Shortlisted',
      scope: 'candidate',
      created_at: '2026-07-01T09:00:00Z',
    },
  ],
  added_at: '2026-07-30T09:00:00Z',
};

export const YOUSSEF_SAVED: PooledCandidate = {
  candidate_id: YOUSSEF.candidate_id,
  full_name: 'Youssef Nassar',
  avatar_url: null,
  headline: 'Site nurse',
  location_name: 'Damascus',
  canonical_role_name: 'Nurse',
  total_experience_years: 1,
  tags: [
    {
      id: '00000000-0000-4000-8000-0000000000b1',
      name: 'Arabic speaker',
      scope: 'candidate',
      created_at: '2026-07-01T09:00:00Z',
    },
  ],
  added_at: '2026-07-28T09:00:00Z',
};

export const RIMA_SAVED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000033',
  full_name: 'Rima Sabbagh',
  avatar_url: null,
  headline: null,
  location_name: null,
  canonical_role_name: null,
  total_experience_years: 0,
  tags: [],
  added_at: '2026-07-20T09:00:00Z',
};

export function savedCandidates(count: number): PooledCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    candidate_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    full_name: `Candidate ${index}`,
    avatar_url: null,
    headline: null,
    location_name: null,
    canonical_role_name: null,
    total_experience_years: 0,
    tags: [],
    added_at: '2026-07-01T09:00:00Z',
  }));
}
