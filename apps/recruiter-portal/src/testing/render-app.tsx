import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from '@/lib/router';
import { ThemeProvider } from '@/lib/theme';

/**
 * Mounts the app the way `main.tsx` does — real router, real query client, real API client —
 * with only the network intercepted by MSW. The router settles before the helper returns, so
 * tests assert on a loaded route rather than on a pending one.
 */
export async function renderApp(path = '/') {
  window.history.replaceState(null, '', path);
  localStorage.clear();
  document.documentElement.className = '';

  const queryClient = createQueryClient();
  // The real policy retries a 5xx once; the real backoff would just make tests wait for it.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
  });

  const router = createAppRouter(queryClient);
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );

  await act(async () => {
    await router.load();
  });
  return { ...utils, router, queryClient, user };
}
