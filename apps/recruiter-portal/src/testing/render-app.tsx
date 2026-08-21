import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from '@/lib/router';

const SETTLED = { timeout: 10_000 };

const ROUTE_SKELETON = '[data-slot="route-skeleton"]';

export function startApp(path = '/') {
  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router, queryClient, user: userEvent.setup() };
}

export async function renderApp(path = '/') {
  const { router, queryClient, user } = startApp(path);

  await waitFor(() => expect(router.state.status).toBe('idle'), SETTLED);
  await waitFor(() => expect(document.querySelector(ROUTE_SKELETON)).toBeNull(), SETTLED);

  return { router, queryClient, user };
}
