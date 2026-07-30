import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { NotFound } from '@/features/shell/components/not-found';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { RouteError } from '@/features/shell/components/route-error';
import { routeTree } from '@/routeTree.gen';
import { onSessionExpired } from './api';
import { queryClient as defaultQueryClient } from './query-client';

export function createAppRouter(queryClient: QueryClient = defaultQueryClient) {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPendingComponent: PageSkeleton,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });

  let redirecting = false;
  onSessionExpired(() => {
    // Mid-navigation the route guard is already deciding where an expired session goes, and
    // navigating from under it would deadlock the load in progress. This handler exists for
    // the other case: a session that dies while the user is sitting on a loaded page.
    if (router.state.status === 'pending') return;

    const { pathname, href } = router.state.location;
    if (redirecting || pathname === '/login') return;
    redirecting = true;
    // Navigate before clearing: a guarded panel left refetching without a session would
    // only trip this same handler again.
    void router
      .navigate({ to: '/login', search: { returnTo: href }, replace: true })
      .then(() => queryClient.clear())
      .finally(() => {
        redirecting = false;
      });
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
