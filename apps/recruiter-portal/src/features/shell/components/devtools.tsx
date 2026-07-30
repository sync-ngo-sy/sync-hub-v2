import { lazy, Suspense } from 'react';

/** The ternaries fold to `null` in a production build, dropping the dynamic imports too. */
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
