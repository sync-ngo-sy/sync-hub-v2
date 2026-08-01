import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JobStatus } from '../job';
import { jobsQuery } from './use-jobs';

export function useCreateJob(status?: JobStatus) {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/tenants/me/jobs', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobsQuery(status).queryKey }),
  });
}

export function useChangeJob(status?: JobStatus) {
  const queryClient = useQueryClient();

  return api.useMutation('patch', '/v1/tenants/me/jobs/{job_id}', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobsQuery(status).queryKey }),
  });
}
