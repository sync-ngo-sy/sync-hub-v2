import {
  CardSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
  SkeletonText,
} from '@sync/ui/components/skeletons';

export function AccountSettingsSkeleton() {
  return (
    <RouteSkeleton label="Loading your account settings" className="space-y-(--space-section)">
      <PageHeaderSkeleton />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={3} />
      <div className="border-t border-destructive/30 pt-8">
        <SkeletonText lines={2} />
      </div>
    </RouteSkeleton>
  );
}
