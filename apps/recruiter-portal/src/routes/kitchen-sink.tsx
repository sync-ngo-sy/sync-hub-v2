import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { NotFound } from '@/features/shell/components/not-found';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { pageTitle } from '@/lib/page-title';

/** In a production build the ternary folds to `null` and the gallery's chunk is never emitted. */
const KitchenSink = import.meta.env.DEV
  ? lazy(() => import('@/features/kitchen-sink/components/kitchen-sink'))
  : null;

export const Route = createFileRoute('/kitchen-sink')({
  head: () => ({ meta: [{ title: pageTitle('Kitchen sink') }] }),
  component: KitchenSinkRoute,
});

function KitchenSinkRoute() {
  if (!KitchenSink) return <NotFound />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KitchenSink />
    </Suspense>
  );
}
