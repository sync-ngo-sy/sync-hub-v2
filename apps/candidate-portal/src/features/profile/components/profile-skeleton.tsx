import {
  CardSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
} from '@sync/ui/components/skeletons';

export function ProfileSkeleton() {
  return (
    <RouteSkeleton label="Loading your profile" className="space-y-(--space-section)">
      <PageHeaderSkeleton />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-(--space-grid)">
        <CardSkeleton lines={4} className="lg:col-start-2" />

        <div className="mt-6 min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
          <FormSkeleton fields={4} submit={false} />
          <FormSkeleton fields={3} submit={false} />
        </div>
      </div>
    </RouteSkeleton>
  );
}
