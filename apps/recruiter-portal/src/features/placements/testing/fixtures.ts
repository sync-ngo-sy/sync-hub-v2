import { FIELD, MEAL } from '@/features/applications/testing/fixtures';
import type { HireClaim } from '../placement';

export const NOUR_PLACED: HireClaim = {
  application_id: '00000000-0000-4000-8000-000000000411',
  candidate_name: 'Nour Haddad',
  job: MEAL,
  start_date: '2026-09-01',
  confirmation: 'confirmed',
  claimed_at: '2026-08-12T09:00:00Z',
  answered_at: '2026-08-13T09:00:00Z',
};

export const SAMER_WAITING: HireClaim = {
  application_id: '00000000-0000-4000-8000-000000000412',
  candidate_name: 'Samer Khoury',
  job: FIELD,
  start_date: '2026-10-01',
  confirmation: 'unanswered',
  claimed_at: '2026-03-04T09:00:00Z',
  answered_at: null,
};

export const LAYLA_DENIED: HireClaim = {
  application_id: '00000000-0000-4000-8000-000000000413',
  candidate_name: 'Layla Aziz',
  job: MEAL,
  start_date: '2026-07-01',
  confirmation: 'denied',
  claimed_at: '2026-06-01T09:00:00Z',
  answered_at: '2026-06-02T09:00:00Z',
};

export const EVERY_CLAIM = [NOUR_PLACED, SAMER_WAITING, LAYLA_DENIED];

export function claimedHires(howMany: number, confirmation: HireClaim['confirmation']) {
  return Array.from({ length: howMany }, (_, index) => ({
    ...NOUR_PLACED,
    application_id: `00000000-0000-4000-8000-0000004${String(index).padStart(5, '0')}`,
    candidate_name: `Hire ${index}`,
    confirmation,
    answered_at: confirmation === 'unanswered' ? null : NOUR_PLACED.answered_at,
  })) satisfies HireClaim[];
}
