import type { PooledCandidate } from '../pool';

export const AMINA_SAVED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  headline: 'Backend engineer, 8 years',
  location_name: 'Aleppo',
  added_at: '2026-08-03T09:00:00Z',
};

export const YOUSSEF_SAVED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000032',
  full_name: 'Youssef Nassar',
  headline: 'Site nurse',
  location_name: 'Damascus',
  added_at: '2026-07-28T09:00:00Z',
};

export const RIMA_SAVED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000033',
  full_name: 'Rima Sabbagh',
  headline: null,
  location_name: null,
  added_at: '2026-07-20T09:00:00Z',
};

export function savedCandidates(count: number): PooledCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    candidate_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    full_name: `Candidate ${index}`,
    headline: null,
    location_name: null,
    added_at: '2026-07-01T09:00:00Z',
  }));
}
