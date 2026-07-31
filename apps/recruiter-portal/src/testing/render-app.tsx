import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from '@/lib/router';

/**
 * The whole app, at a starting URL: the real router, the real query client and the real
 * generated API client, with MSW the only stand-in.
 */
export async function renderApp(path = '/') {
  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(router.state.status).toBe('idle'));

  return { router, queryClient, user: userEvent.setup() };
}
