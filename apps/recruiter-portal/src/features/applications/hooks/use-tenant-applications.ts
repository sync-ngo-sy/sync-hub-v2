import { api } from '@/lib/api';
import type { TenantApplicationFilters } from '../reading';
import { statusCountsFrom, verdictCountsFrom } from './use-job-applications';

export const TENANT_APPLICATIONS_PAGE_SIZE = 20;

const PATH = '/v1/tenants/me/applications';

export function useTenantApplications(filters: TenantApplicationFilters) {
  return api.useInfiniteQuery(
    'get',
    PATH,
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
