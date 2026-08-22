import { keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TENANT_APPLICATIONS_PATH,
  type TenantApplicationsAsked,
  tenantApplications,
} from '../reread';
import { statusCountsFrom, verdictCountsFrom } from './use-job-applications';

export function useTenantApplications(asked: TenantApplicationsAsked) {
  return api.useInfiniteQuery('get', TENANT_APPLICATIONS_PATH, tenantApplications(asked), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    placeholderData: keepPreviousData,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items),
      statusCounts: statusCountsFrom(data.pages[0]?.status_counts),
      verdictCounts: verdictCountsFrom(data.pages[0]?.verdict_counts),
    }),
  });
}
