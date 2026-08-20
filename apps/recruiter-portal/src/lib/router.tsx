import type { QueryClient } from '@tanstack/react-query';
import { type AnyRouter, createRouter, type RouterHistory } from '@tanstack/react-router';
import { currentProfileQuery } from '@/features/auth/current-profile';
import { NotFound } from '@/features/shell/components/not-found';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { RouteError } from '@/features/shell/components/route-error';
import { routeTree } from '@/routeTree.gen';
import { onAccessRefused, onSessionExpired } from './api';

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
    whenSettled(router, () => {
      redirecting = false;
      const { pathname, href } = router.state.location;
      if (pathname === '/login') return;
      if (!router.state.matches.some((match) => match.staticData.requiresSession)) {
        queryClient.removeQueries({ queryKey: currentProfileQuery.queryKey });
        return;
      }
      redirecting = true;
      queryClient.clear();
      void router
        .navigate({ to: '/login', search: { returnTo: href }, replace: true })
        .finally(() => {
          redirecting = false;
        });
    });
  });

  onAccessRefused(() => {
    whenSettled(router, () => {
      if (router.state.location.pathname === '/access-refused') return;
      void router.navigate({ to: '/access-refused', replace: true });
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
