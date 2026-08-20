import { api } from '@/lib/api';
import type { TenantApplicationFilters } from '../reading';
import { TENANT_APPLICATIONS_PATH, tenantApplications } from '../reread';
import { statusCountsFrom, verdictCountsFrom } from './use-job-applications';

export function useTenantApplications(filters: TenantApplicationFilters) {
  return api.useInfiniteQuery('get', TENANT_APPLICATIONS_PATH, tenantApplications(filters), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items),
      statusCounts: statusCountsFrom(data.pages[0]?.status_counts),
      verdictCounts: verdictCountsFrom(data.pages[0]?.verdict_counts),
    }),
  });
}
