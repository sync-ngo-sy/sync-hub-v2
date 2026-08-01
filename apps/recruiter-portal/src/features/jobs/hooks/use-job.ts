import { api } from '@/lib/api';

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
