import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { jobQuery } from './use-job';
import { jobsQueryPrefix } from './use-jobs';

export function useCreateJob() {
  const queryClient = useQueryClient();

  return api.useMutation('post', '/v1/tenants/me/jobs', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobsQueryPrefix() }),
  });
}

export function useChangeJob() {
  const queryClient = useQueryClient();

  return api.useMutation('patch', '/v1/tenants/me/jobs/{job_id}', {
    onSuccess: (job) => {
      queryClient.setQueryData(jobQuery(job.id).queryKey, job);
      return queryClient.invalidateQueries({ queryKey: jobsQueryPrefix() });
    },
  });
}

export function useReplaceJobCriteria() {
  const queryClient = useQueryClient();

  return api.useMutation('put', '/v1/tenants/me/jobs/{job_id}/criteria', {
    onSuccess: (criteria, variables) => {
      queryClient.setQueryData(jobQuery(variables.params.path.job_id).queryKey, (job) =>
        job ? { ...job, criteria } : job,
      );
    },
  });
}
