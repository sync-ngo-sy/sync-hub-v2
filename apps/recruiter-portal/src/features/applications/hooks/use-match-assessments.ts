import { api } from '@/lib/api';

const PATH = '/v1/tenants/me/applications/{application_id}/assessment';

function init(applicationId: string) {
  return { params: { path: { application_id: applicationId } } };
}

export function matchAssessmentQueryKey(applicationId: string) {
  return api.queryOptions('get', PATH, init(applicationId)).queryKey;
}

export function useMatchAssessment(applicationId: string) {
  return api.useQuery('get', PATH, init(applicationId), {
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}
