import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { NotFound } from '@/features/shell/components/not-found';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

/**
 * Dev-only, the same way the devtools are: in a production build the ternary folds to `null`
 * and the dynamic import is dropped, so the design-system gallery ships no chunk at all.
 */
const KitchenSink = import.meta.env.DEV
  ? lazy(() => import('@/features/kitchen-sink/components/kitchen-sink'))
  : null;

export const Route = createFileRoute('/kitchen-sink')({
  head: () => ({ meta: [{ title: 'Kitchen sink · Sync Recruiter' }] }),
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
