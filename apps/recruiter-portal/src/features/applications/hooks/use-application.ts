import { type QueryClient, useQuery } from '@tanstack/react-query';
import { problemStatus } from '@/lib/api-problem';
import { applicationReview } from '../reread';
import type { ApplicationReview } from '../review';

export function useApplication(applicationId: string) {
  return useQuery({ ...applicationReview(applicationId), throwOnError: true });
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
