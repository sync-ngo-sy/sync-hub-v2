import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { problemStatus } from '@/lib/api-problem';
import { APPLICATION_PATH, applicationReview, onApplication } from '../reread';
import type { ApplicationReview } from '../review';

export function useApplication(applicationId: string) {
  return api.useQuery('get', APPLICATION_PATH, onApplication(applicationId), {
    throwOnError: true,
  });
}

export async function ensureApplication(
  queryClient: QueryClient,
  applicationId: string,
): Promise<ApplicationReview | null> {
  try {
    return await queryClient.ensureQueryData(applicationReview(applicationId));
  } catch (error) {
    if (problemStatus(error) === 404) return null;
    throw error;
  }
}
