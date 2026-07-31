import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { delay } from 'msw';
import { TOO_MANY_REQUESTS } from '@/testing/fixtures';

type PublicJob = components['schemas']['PublicJobSummary'];

export function listsJobs(items: PublicJob[]) {
  return [http.get('/v1/jobs', ({ response }) => response(200).json({ items, next_cursor: null }))];
}

export function publishesNothing() {
  return listsJobs([]);
}

/** Never answers, so the pending index can be looked at. */
export function withholdsJobs() {
  return [
    http.get('/v1/jobs', async ({ response }) => {
      await delay('infinite');
      return response(200).json({ items: [], next_cursor: null });
    }),
  ];
}

export function ratelimitsJobs() {
  return [http.get('/v1/jobs', ({ response }) => response(429).json(TOO_MANY_REQUESTS))];
}
