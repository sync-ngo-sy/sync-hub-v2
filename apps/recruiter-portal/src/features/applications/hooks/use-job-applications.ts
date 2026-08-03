import { api } from '@/lib/api';
import type { ApplicationStatus, QualificationStatus } from '../application';

export const APPLICATIONS_PAGE_SIZE = 20;

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';

export interface ApplicationFilters {
  status?: ApplicationStatus;
  qualification?: QualificationStatus;
}

export function useJobApplications(jobId: string, filters: ApplicationFilters) {
  return api.useInfiniteQuery(
    'get',
    PATH,
    {
      params: {
        path: { job_id: jobId },
        query: {
          limit: APPLICATIONS_PAGE_SIZE,
          status: filters.status,
          qualification_status: filters.qualification,
        },
      },
    },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => data.pages.flatMap((page) => page.items),
    },
  );
}
