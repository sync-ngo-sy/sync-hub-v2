import { CenteredNoticeSkeleton, RouteSkeleton } from '@sync/ui/components/skeletons';
import { CenteredScreen } from './centered-screen';

export function CenteredSkeleton({ label, action }: { label: string; action?: boolean }) {
  return (
    <CenteredScreen>
      <RouteSkeleton label={label} className="space-y-4">
        <CenteredNoticeSkeleton action={action} />
      </RouteSkeleton>
    </CenteredScreen>
  );
}
