import { QueryClient } from '@tanstack/react-query';
import { problemStatus } from './api-problem';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => count < 1 && problemStatus(error) !== 401,
      },
      mutations: { retry: 0 },
    },
  });
}
