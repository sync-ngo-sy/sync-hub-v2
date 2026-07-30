import { QueryClient } from '@tanstack/react-query';
import { isClientError } from './problem';

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

export const queryClient = createQueryClient();
