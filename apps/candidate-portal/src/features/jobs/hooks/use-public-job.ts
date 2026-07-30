import { api } from '../../../lib/api-client';
import { errorStatus } from '../../../lib/errors';

export function usePublicJob(jobId: string) {
  return api.useQuery(
    'get',
    '/v1/jobs/{job_id}',
    { params: { path: { job_id: jobId } } },
    // A 404 is an unknown Job, rendered inline as a not-found; anything else goes to the boundary.
    { throwOnError: (error) => errorStatus(error) !== 404 },
  );
}
