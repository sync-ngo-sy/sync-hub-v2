import { lazy, Suspense } from 'react';

/** Dev server only — a production build folds the ternary away and never emits the chunk. */
const ReactQueryDevtools =
  import.meta.env.MODE === 'development'
    ? lazy(() =>
        import('@tanstack/react-query-devtools').then((module) => ({
          default: module.ReactQueryDevtools,
        })),
      )
    : null;

export function Devtools() {
  if (!ReactQueryDevtools) return null;
  return (
    <Suspense fallback={null}>
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </Suspense>
  );
}
