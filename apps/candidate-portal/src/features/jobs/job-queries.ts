import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';
import type { Job } from './job';

const jobQuery = (jobId: string) =>
  api.queryOptions('get', '/v1/jobs/{job_id}', { params: { path: { job_id: jobId } } });

const trackedLinkQuery = (token: string) =>
  api.queryOptions('get', '/v1/jobs/by-link/{token}', { params: { path: { token } } });

export function ensureJob(queryClient: QueryClient, jobId: string): Promise<Job | null> {
  return nullIfNotFound(queryClient.ensureQueryData(jobQuery(jobId)));
}

export function ensureJobByTrackedLink(
  queryClient: QueryClient,
  token: string,
): Promise<Job | null> {
  return nullIfNotFound(queryClient.ensureQueryData(trackedLinkQuery(token)));
}

async function nullIfNotFound(pending: Promise<Job>): Promise<Job | null> {
  try {
    return await pending;
  } catch (error) {
    if (problemStatus(error) === 404) return null;
    throw error;
  }
}
