import { api } from '@/lib/api';
import type { PipelineStatus, ReceivedWithin } from '../application';
import { statusCountsFrom } from './use-job-applications';

export const TENANT_APPLICATIONS_PAGE_SIZE = 20;

const PATH = '/v1/tenants/me/applications';

export interface TenantApplicationFilters {
  pipeline?: PipelineStatus[];
  received?: ReceivedWithin;
}

export function useTenantApplications(filters: TenantApplicationFilters) {
  return api.useInfiniteQuery(
    'get',
    PATH,
    {
      params: {
        query: {
          limit: TENANT_APPLICATIONS_PAGE_SIZE,
          status: filters.pipeline,
          received_within: filters.received ?? null,
        },
      },
    },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => ({
        items: data.pages.flatMap((page) => page.items),
        statusCounts: statusCountsFrom(data.pages[0]?.status_counts),
      }),
    },
  );
}
