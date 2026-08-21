import { FormSkeleton, PageHeaderSkeleton, RouteSkeleton } from '@sync/ui/components/skeletons';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { WIZARD_STEPS } from '../wizard';

export function JobWizardSkeleton() {
  return (
    <RouteSkeleton label="Loading the Job form" className="space-y-(--space-section)">
      <PageHeaderSkeleton />

      <div className="flex items-center gap-4" aria-hidden="true">
        {WIZARD_STEPS.map((step) => (
          <Skeleton key={step} className="h-8 w-32" />
        ))}
      </div>

      <Card aria-hidden="true">
        <CardContent className="pt-6">
          <FormSkeleton fields={5} submit={false} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between" aria-hidden="true">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </RouteSkeleton>
  );
}
