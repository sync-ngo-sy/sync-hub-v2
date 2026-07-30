import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { api, client } from '../lib/api-client';
import { setAuthenticated, setSessionExpiredHandler } from '../lib/session';
import { routeTree } from '../routeTree.gen';

/**
 * Renders the real router — real routes, guards, hooks, and client — over MSW, at a chosen
 * location. A fresh QueryClient per call keeps tests isolated; it is shared between the router
 * context (used by `beforeLoad` guards) and the provider (used by feature hooks), exactly as
 * the app wires them.
 */
export function renderApp(initialPath = '/') {
  // The session latch is module-global, so clear it between renders to keep tests isolated.
  setAuthenticated(false);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  const router = createRouter({ routeTree, context: { queryClient, api, client }, history });

  // Wire the session-expiry redirect against this router, exactly as lib/router.ts does for the app.
  setSessionExpiredHandler(() => {
    const returnTo = router.state.location.href;
    queryClient.clear();
    router.navigate({ to: '/login', search: { returnTo } });
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router, queryClient, ...utils };
}
