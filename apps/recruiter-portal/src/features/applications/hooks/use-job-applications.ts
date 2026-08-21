import { api } from '@/lib/api';
import type { PipelineStatus, ScreeningVerdict } from '../application';
import type { ApplicationFilters } from '../reading';
import { TRIAGE_PATH } from '../reread';

export const APPLICATIONS_PAGE_SIZE = 20;

export type StatusCounts = Partial<Record<PipelineStatus, number>>;
export type VerdictCounts = Partial<Record<ScreeningVerdict, number>>;

export function statusCountsFrom(
  counted: { status: PipelineStatus; count: number }[] | undefined,
): StatusCounts {
  return Object.fromEntries((counted ?? []).map((one) => [one.status, one.count])) as StatusCounts;
}

export function verdictCountsFrom(
  counted: { verdict: ScreeningVerdict; count: number }[] | undefined,
): VerdictCounts {
  return Object.fromEntries(
    (counted ?? []).map((one) => [one.verdict, one.count]),
  ) as VerdictCounts;
}

export function useJobApplications(jobId: string, filters: ApplicationFilters) {
  return api.useInfiniteQuery(
    'get',
    TRIAGE_PATH,
    {
      params: {
        path: { job_id: jobId },
        query: {
          limit: APPLICATIONS_PAGE_SIZE,
          status: filters.pipeline,
          qualification_status: filters.screening,
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
