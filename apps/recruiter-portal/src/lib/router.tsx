import type { QueryClient } from '@tanstack/react-query';
import { type AnyRouter, createRouter, type RouterHistory } from '@tanstack/react-router';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { NotFound } from '@/features/shell/components/not-found';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { RouteError } from '@/features/shell/components/route-error';
import { routeTree } from '@/routeTree.gen';
import { onSessionExpired } from './api';

function whenSettled(router: AnyRouter, run: () => void): void {
  if (router.state.status !== 'pending') {
    run();
    return;
  }
  const unsubscribe = router.subscribe('onResolved', () => {
    unsubscribe();
    run();
  });
}

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history,
    defaultPreload: 'intent',
    defaultPendingComponent: PageSkeleton,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });

  let redirecting = false;
  onSessionExpired(() => {
    if (redirecting) return;
    redirecting = true;
    // Expiry can be raised mid-navigation, and navigating out from under an in-flight load
    // deadlocks the router — so wait for it to settle. By then a guard may already have sent
    // the visitor to sign in, which is why this re-checks where we ended up.
    whenSettled(router, () => {
      redirecting = false;
      const { pathname, href } = router.state.location;
      if (pathname === '/login') return;
      if (!router.state.matches.some((match) => match.staticData.requiresSession)) {
        queryClient.removeQueries({ queryKey: currentProfileQuery.queryKey });
        return;
      }
      redirecting = true;
      // Drop the dead session before navigating: the login route re-reads the profile, and a
      // cached "still signed in" answer would bounce the visitor straight back.
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

  interface StaticDataRouteOption {
    requiresSession?: boolean;
  }
}
