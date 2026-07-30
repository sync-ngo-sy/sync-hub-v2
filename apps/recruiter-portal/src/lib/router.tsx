import type { QueryClient } from '@tanstack/react-query';
import { type AnyRouter, createRouter } from '@tanstack/react-router';
import { NotFound } from '@/features/shell/components/not-found';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { RouteError } from '@/features/shell/components/route-error';
import { routeTree } from '@/routeTree.gen';
import { setSessionExpiredHandler } from './api';

function whenIdle(router: AnyRouter, run: () => void): void {
  if (router.state.status !== 'pending') {
    run();
    return;
  }
  const unsubscribe = router.subscribe('onResolved', () => {
    unsubscribe();
    run();
  });
}

export function createAppRouter(queryClient: QueryClient) {
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
  setSessionExpiredHandler(() => {
    if (redirecting) return;
    redirecting = true;
    // The client can raise expiry mid-navigation, and navigating out from under an in-flight
    // load deadlocks it — so wait for the router to settle. By then a guard may already have
    // sent an unauthenticated visitor to the login page, which is why this re-checks.
    whenIdle(router, () => {
      const { pathname, href } = router.state.location;
      if (pathname === '/login') {
        redirecting = false;
        return;
      }
      // Drop the dead session's cache before navigating: the login route re-checks the
      // profile, and a stale "still signed in" answer would bounce the user right back.
      queryClient.clear();
      void router
        .navigate({ to: '/login', search: { returnTo: href }, replace: true })
        .finally(() => {
          redirecting = false;
        });
    });
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
