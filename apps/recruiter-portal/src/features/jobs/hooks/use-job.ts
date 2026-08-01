import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export function useJob(jobId: string) {
  const job = api.useQuery('get', '/v1/tenants/me/jobs/{job_id}', {
    params: { path: { job_id: jobId } },
  });

  const { error } = job;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Edit Job' });
  }, [error]);

  return job;
}
