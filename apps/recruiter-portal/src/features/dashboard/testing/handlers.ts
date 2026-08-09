import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { holding } from '@/testing/holding';

type Problem = components['schemas']['ProblemDetail'];
type TenantStats = components['schemas']['TenantStats'];

const STATS = '/v1/tenants/me/stats';

export function servesStats(stats: TenantStats) {
  return [http.get(STATS, ({ response }) => response(200).json(stats))];
}

export function failsToServeStats(problem: Problem) {
  return [http.get(STATS, ({ response }) => response(500).json(problem))];
}

export function holdsStats(stats: TenantStats) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(STATS, async ({ response }) => {
        await gate.held;
        return response(200).json(stats);
      }),
    ],
  };
}
