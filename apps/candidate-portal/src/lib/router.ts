import { createRouter } from '@tanstack/react-router';
import { RouteErrorFallback } from '../components/route-error-fallback';
import { RoutePending } from '../components/route-pending';
import { routeTree } from '../routeTree.gen';
import { api, client } from './api-client';
import { createAppQueryClient } from './query-client';
import { reportError } from './report-error';
import { setSessionExpiredHandler } from './session';

export const queryClient = createAppQueryClient();

export const router = createRouter({
  routeTree,
  context: { queryClient, api, client },
  defaultPreload: 'intent',
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteErrorFallback,
  defaultOnCatch: (error) => reportError(error, { boundary: 'router' }),
});

setSessionExpiredHandler(() => {
  // The session is gone: drop the cached profile so guards can't treat it as still live, then
  // send the user to login carrying where they were.
  const returnTo = router.state.location.href;
  queryClient.clear();
  router.navigate({ to: '/login', search: { returnTo } });
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
