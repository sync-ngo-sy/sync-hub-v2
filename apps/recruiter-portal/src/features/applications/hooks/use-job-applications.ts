import { api } from '@/lib/api';
import type { PipelineStatus, ScreeningVerdict } from '../application';

export const APPLICATIONS_PAGE_SIZE = 20;

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';

export interface ApplicationFilters {
  pipeline?: PipelineStatus[];
  screening?: ScreeningVerdict[];
}

export type StatusCounts = Partial<Record<PipelineStatus, number>>;
export type VerdictCounts = Partial<Record<ScreeningVerdict, number>>;

export function jobApplicationsQueryPrefix() {
  return api.queryOptions('get', PATH, { params: { path: { job_id: '' } } }).queryKey.slice(0, 2);
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
          status: filters.pipeline,
          qualification_status: filters.screening,
        },
      },
    },
    {
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => ({
        items: data.pages.flatMap((page) => page.items),
        statusCounts: Object.fromEntries(
          (data.pages[0]?.status_counts ?? []).map((one) => [one.status, one.count]),
        ) as StatusCounts,
        verdictCounts: Object.fromEntries(
          (data.pages[0]?.verdict_counts ?? []).map((one) => [one.verdict, one.count]),
        ) as VerdictCounts,
      }),
    },
  );
}
