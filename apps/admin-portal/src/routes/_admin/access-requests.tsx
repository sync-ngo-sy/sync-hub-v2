import { createFileRoute } from '@tanstack/react-router';
import { AccessRequests } from '@/features/platform/access-requests';
import { AccessRequestsSkeleton } from '@/features/platform/access-requests-skeleton';

export const Route = createFileRoute('/_admin/access-requests')({
  pendingComponent: AccessRequestsSkeleton,
  component: AccessRequests,
});
