import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';
import type { ApplicationReview } from '../review';

const PATH = '/v1/tenants/me/applications/{application_id}';

export function applicationQuery(applicationId: string) {
  return api.queryOptions('get', PATH, { params: { path: { application_id: applicationId } } });
}

export function useApplication(applicationId: string) {
  return api.useQuery(
    'get',
    PATH,
    { params: { path: { application_id: applicationId } } },
    { throwOnError: true },
  );
}

export async function ensureApplication(
  queryClient: QueryClient,
  applicationId: string,
): Promise<ApplicationReview | null> {
  try {
    return await queryClient.ensureQueryData(applicationQuery(applicationId));
  } catch (error) {
    if (problemStatus(error) === 404) return null;
    throw error;
  }
}
