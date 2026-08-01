import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';
import type { Job } from './job';

const jobQuery = (jobId: string) =>
  api.queryOptions('get', '/v1/jobs/{job_id}', { params: { path: { job_id: jobId } } });

const trackedLinkQuery = (token: string) =>
  api.queryOptions('get', '/v1/jobs/by-link/{token}', { params: { path: { token } } });

/** `null` is an answer, not a failure: no published Job has that id. */
export function ensureJob(queryClient: QueryClient, jobId: string): Promise<Job | null> {
  return orNothing(queryClient.ensureQueryData(jobQuery(jobId)));
}

/**
 * The Job a Tracked link leads to. Resolving it is what counts the view, so this runs once per
 * arrival — and `null` covers every way a link stops working: spent, switched off, or never ours.
 */
export function ensureJobByTrackedLink(
  queryClient: QueryClient,
  token: string,
): Promise<Job | null> {
  return orNothing(queryClient.ensureQueryData(trackedLinkQuery(token)));
}

async function orNothing(pending: Promise<Job>): Promise<Job | null> {
  try {
    return await pending;
  } catch (error) {
    // Only a 404 is an absence. A fault or rate limit is the error boundary's retry, not a
    // "this role is gone" the reader would believe.
    if (problemStatus(error) === 404) return null;
    throw error;
  }
}
