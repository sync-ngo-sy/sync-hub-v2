import { ListSkeleton, PageHeaderSkeleton } from '@sync/ui/components/skeletons';

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}
