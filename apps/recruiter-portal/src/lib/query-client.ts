import { QueryClient } from '@tanstack/react-query';
import { isClientError } from './api-problem';

/** The defaults §7 of the design document fixes for both portals. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => failureCount < 1 && !isClientError(error),
      },
      mutations: { retry: 0 },
    },
  });
}
