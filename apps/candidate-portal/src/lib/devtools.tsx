import { lazy, Suspense } from 'react';

const enabled = import.meta.env.DEV && import.meta.env.MODE !== 'test';

const RouterDevtools = enabled
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )
  : null;

const QueryDevtools = enabled
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : null;

export function Devtools() {
  if (!RouterDevtools || !QueryDevtools) return null;
  return (
    <Suspense fallback={null}>
      <RouterDevtools position="bottom-right" />
      <QueryDevtools buttonPosition="bottom-left" />
    </Suspense>
  );
}
