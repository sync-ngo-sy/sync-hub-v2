import { api } from '@/lib/api';
import type { TenantApplicationFilters } from '../reading';
import { TENANT_APPLICATIONS_PATH } from '../reread';
import { statusCountsFrom, verdictCountsFrom } from './use-job-applications';

export const TENANT_APPLICATIONS_PAGE_SIZE = 20;

export function useTenantApplications(filters: TenantApplicationFilters) {
  return api.useInfiniteQuery(
    'get',
    TENANT_APPLICATIONS_PATH,
    {
      params: {
        query: {
          limit: TENANT_APPLICATIONS_PAGE_SIZE,
          status: filters.pipeline,
          qualification_status: filters.screening,
          received_within: filters.received ?? null,
          sort: filters.sort,
        },
      },
    },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => ({
        items: data.pages.flatMap((page) => page.items),
        statusCounts: statusCountsFrom(data.pages[0]?.status_counts),
        verdictCounts: verdictCountsFrom(data.pages[0]?.verdict_counts),
      }),
    },
  );
}
