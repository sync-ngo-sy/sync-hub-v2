import { RouteSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { NotFound } from '@/features/shell/components/not-found';
import { pageTitle } from '@/lib/page-title';

const KitchenSink = import.meta.env.DEV
  ? lazy(() => import('@/features/kitchen-sink/components/kitchen-sink'))
  : null;

export const Route = createFileRoute('/kitchen-sink')({
  head: () => ({ meta: [{ title: pageTitle('Kitchen sink') }] }),
  pendingComponent: KitchenSinkSkeleton,
  component: KitchenSinkRoute,
});

function KitchenSinkSkeleton() {
  return (
    <RouteSkeleton label="Loading the kitchen sink">
      <SkeletonText lines={6} />
    </RouteSkeleton>
  );
}

function KitchenSinkRoute() {
  if (!KitchenSink) return <NotFound />;
  return (
    <Suspense fallback={<KitchenSinkSkeleton />}>
      <KitchenSink />
    </Suspense>
  );
}
