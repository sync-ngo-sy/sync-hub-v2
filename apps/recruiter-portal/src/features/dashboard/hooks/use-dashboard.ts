import { useQueries, useQuery } from '@tanstack/react-query';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import { api } from '@/lib/api';
import {
  APPLICATIONS_PER_JOB,
  type ApplicationsRead,
  type JobApplications,
  type JobsRead,
  readApplications,
  readJobs,
} from '../dashboard';

const APPLICATIONS_PATH = '/v1/tenants/me/jobs/{job_id}/applications';

/** A first page, which is what keeps this key clear of the triage list's infinite query. */
export function applicationsFirstPageQuery(jobId: string) {
  return api.queryOptions('get', APPLICATIONS_PATH, {
    params: {
      path: { job_id: jobId },
      query: { limit: APPLICATIONS_PER_JOB, cursor: null },
    },
  });
}

export interface PanelRead<TData> {
  data?: TData;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

export interface DashboardRead {
  tenantName?: string;
  jobs: PanelRead<JobsRead>;
  applications: PanelRead<ApplicationsRead>;
}

export function useDashboard(): DashboardRead {
  const tenant = api.useQuery('get', '/v1/tenants/me', {});

  const jobs = useQuery(jobsFirstPageQuery());
  const jobsRead = jobs.data ? readJobs(jobs.data) : undefined;

  const pages = useQueries({
    queries: (jobsRead?.toCount ?? []).map((job) => applicationsFirstPageQuery(job.id)),
  });

  const arrived: JobApplications[] = (jobsRead?.toCount ?? []).flatMap((job, index) => {
    const page = pages[index]?.data;
    return page ? [{ job, page }] : [];
  });
  const refused = pages.find((page) => page.error);

  return {
    tenantName: tenant.data?.name,
    jobs: {
      data: jobsRead,
      isPending: jobs.isPending,
      error: jobs.error,
      refetch: () => void jobs.refetch(),
    },
    applications: {
      data: jobsRead
        ? readApplications(arrived, {
            now: new Date(),
            everyJob: jobsRead.everyJob && refused === undefined,
          })
        : undefined,
      isPending: jobs.isPending || pages.some((page) => page.isPending),
      error: jobs.error ?? refused?.error,
      refetch: () => {
        if (jobs.error) void jobs.refetch();
        for (const page of pages) if (page.error) void page.refetch();
      },
    },
  };
}
