import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import {
  PIPELINE_STATUSES,
  SCREENING_VERDICTS,
  type TenantApplication,
} from '@/features/applications/application';
import { holding } from '@/testing/holding';
import { STATS_PATH } from '../reread';

type Problem = components['schemas']['ProblemDetail'];
type TenantStats = components['schemas']['TenantStats'];

export function servesStats(stats: TenantStats) {
  return [http.get(STATS_PATH, ({ response }) => response(200).json(stats))];
}

function countedBy<TKey extends string>(
  keys: readonly TKey[],
  items: TenantApplication[],
  of: (item: TenantApplication) => TKey,
): Record<TKey, number> {
  return Object.fromEntries(
    keys.map((key) => [key, items.filter((item) => of(item) === key).length]),
  ) as Record<TKey, number>;
}

export function countsApplications(items: TenantApplication[], base: TenantStats) {
  return [
    http.get(STATS_PATH, ({ response }) =>
      response(200).json({
        ...base,
        applications: {
          ...base.applications,
          total: items.length,
          by_status: countedBy(PIPELINE_STATUSES, items, (item) => item.status),
          by_qualification: countedBy(
            SCREENING_VERDICTS,
            items,
            (item) => item.qualification_status,
          ),
        },
      }),
    ),
  ];
}

export function failsToServeStats(problem: Problem) {
  return [http.get(STATS_PATH, ({ response }) => response(500).json(problem))];
}

export function holdsStats(stats: TenantStats) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(STATS_PATH, async ({ response }) => {
        await gate.held;
        return response(200).json(stats);
      }),
    ],
  };
}
