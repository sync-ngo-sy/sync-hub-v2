import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';
import type { Job } from '../job';

export function jobQuery(jobId: string) {
  return api.queryOptions('get', '/v1/tenants/me/jobs/{job_id}', {
    params: { path: { job_id: jobId } },
  });
}

export function useJob(jobId: string) {
  return api.useQuery(
    'get',
    '/v1/tenants/me/jobs/{job_id}',
    { params: { path: { job_id: jobId } } },
    { throwOnError: true },
  );
}

export async function ensureJob(queryClient: QueryClient, jobId: string): Promise<Job | null> {
  try {
    return await queryClient.ensureQueryData(jobQuery(jobId));
  } catch (error) {
    if (problemStatus(error) === 404) return null;
    throw error;
  }
}
