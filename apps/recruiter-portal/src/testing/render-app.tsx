import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from '@/lib/router';

const SETTLED = { timeout: 10_000 };

export async function renderApp(path = '/') {
  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(router.state.status).toBe('idle'), SETTLED);
  await waitFor(
    () => expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull(),
    SETTLED,
  );

  return { router, queryClient, user: userEvent.setup() };
}
