import { AMINA, YOUSSEF } from '@/features/candidates/testing/fixtures';
import type { PooledCandidate } from '../pool';

/** Everyone here signed up and has signed in — the ordinary case. `MIGRATED` is the other one. */
const SIGNED_UP = { is_imported_from_manatal: false, is_claimed: true } as const;

export const AMINA_SAVED: PooledCandidate = {
  candidate_id: AMINA.candidate_id,
  full_name: 'Amina Haddad',
  headline: 'Backend engineer, 8 years',
  location_name: 'Aleppo',
  added_at: '2026-07-30T09:00:00Z',
  ...SIGNED_UP,
};

export const YOUSSEF_SAVED: PooledCandidate = {
  candidate_id: YOUSSEF.candidate_id,
  full_name: 'Youssef Nassar',
  headline: 'Site nurse',
  location_name: 'Damascus',
  added_at: '2026-07-28T09:00:00Z',
  ...SIGNED_UP,
};

export const RIMA_SAVED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000033',
  full_name: 'Rima Sabbagh',
  headline: null,
  location_name: null,
  added_at: '2026-07-20T09:00:00Z',
  ...SIGNED_UP,
};

/** Brought across by scripts/manatal-migration, and nobody has taken the account over. */
export const MIGRATED_SAVED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000034',
  full_name: 'Bashir Nassar',
  headline: 'Logistics officer',
  location_name: 'Homs',
  added_at: '2026-07-18T09:00:00Z',
  is_imported_from_manatal: true,
  is_claimed: false,
};

export function savedCandidates(count: number): PooledCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    candidate_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    full_name: `Candidate ${index}`,
    headline: null,
    location_name: null,
    added_at: '2026-07-01T09:00:00Z',
    ...SIGNED_UP,
  }));
}
