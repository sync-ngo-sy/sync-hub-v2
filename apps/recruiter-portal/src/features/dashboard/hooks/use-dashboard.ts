import { useQuery } from '@tanstack/react-query';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import type { JobSummary } from '@/features/jobs/job';
import { api } from '@/lib/api';
import {
  OVERVIEW_JOBS,
  RECENT_APPLICATIONS,
  type TenantApplication,
  type TenantStats,
} from '../dashboard';

export interface PanelRead<TData> {
  data?: TData;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

export interface DashboardRead {
  tenantName?: string;
  stats: PanelRead<TenantStats>;
  applications: PanelRead<TenantApplication[]>;
  jobs: PanelRead<JobSummary[]>;
}

export function statsQuery() {
  return api.queryOptions('get', '/v1/tenants/me/stats', {});
}

export function recentApplicationsQuery() {
  return api.queryOptions('get', '/v1/tenants/me/applications', {
    params: { query: { limit: RECENT_APPLICATIONS, cursor: null, status: null, job_id: null } },
  });
}

export function useDashboard(): DashboardRead {
  const tenant = api.useQuery('get', '/v1/tenants/me', {});
  const stats = useQuery(statsQuery());
  const applications = useQuery(recentApplicationsQuery());
  const jobs = useQuery(jobsFirstPageQuery());

  return {
    tenantName: tenant.data?.name,
    stats: {
      data: stats.data,
      isPending: stats.isPending,
      error: stats.error,
      refetch: () => void stats.refetch(),
    },
    applications: {
      data: applications.data?.items,
      isPending: applications.isPending,
      error: applications.error,
      refetch: () => void applications.refetch(),
    },
    jobs: {
      data: jobs.data?.items.slice(0, OVERVIEW_JOBS),
      isPending: jobs.isPending,
      error: jobs.error,
      refetch: () => void jobs.refetch(),
    },
  };
}
