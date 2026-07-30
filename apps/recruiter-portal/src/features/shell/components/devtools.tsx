import { lazy, Suspense } from 'react';

/**
 * Built behind `import.meta.env.DEV`, so the ternaries below fold to `null` in a production
 * build and the dynamic imports are dropped with them.
 */
const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : null;

const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
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
