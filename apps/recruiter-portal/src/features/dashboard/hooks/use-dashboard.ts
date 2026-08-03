import { useQueries, useQuery } from '@tanstack/react-query';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import { api } from '@/lib/api';
import {
  type ApplicationsRead,
  DASHBOARD_APPLICATIONS,
  type JobApplications,
  type JobsRead,
  readApplications,
  readJobs,
} from '../dashboard';

const APPLICATIONS_PATH = '/v1/tenants/me/jobs/{job_id}/applications';

/** `cursor: null` is what keeps this key clear of the triage list's infinite query on the same
 * path — the two hash alike without it, and would then fight over one cache entry holding
 * shapes neither can read. The Jobs list uses the same trick for its own first page. */
export function dashboardApplicationsQuery(jobId: string) {
  return api.queryOptions('get', APPLICATIONS_PATH, {
    params: { path: { job_id: jobId }, query: { limit: DASHBOARD_APPLICATIONS, cursor: null } },
  });
}

/** One panel's read: what it has, whether it is still coming, what refused, and how to ask again.
 * Nothing here throws — a dashboard panel that fails says so in its own card. */
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
  // The subtitle alone rides on this, so a refusal costs the page its Tenant's name and
  // nothing else — there is nothing here worth a Retry of its own.
  const tenant = api.useQuery('get', '/v1/tenants/me', {});

  const jobs = useQuery(jobsFirstPageQuery());
  const jobsRead = jobs.data ? readJobs(jobs.data) : undefined;

  const pages = useQueries({
    queries: (jobsRead?.toCount ?? []).map((job) => dashboardApplicationsQuery(job.id)),
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
      // Read from the Jobs that answered: a Job whose page refused makes every count a floor
      // rather than blanking the panel, which is what `everyJob` says downstream.
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
