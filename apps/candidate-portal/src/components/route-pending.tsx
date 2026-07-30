import { CardSkeleton, SkeletonText } from '@sync/ui/components/skeletons';

export function RoutePending() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <SkeletonText lines={2} />
      <CardSkeleton />
    </div>
  );
}
