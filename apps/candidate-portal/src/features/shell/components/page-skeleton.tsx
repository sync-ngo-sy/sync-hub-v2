import { ListSkeleton, PageHeaderSkeleton } from '@sync/ui/components/skeletons';

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-(--space-section)">
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}
