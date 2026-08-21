import { createFileRoute } from '@tanstack/react-router';
import { PlatformOverview } from '@/features/platform/overview';
import { PlatformOverviewSkeleton } from '@/features/platform/overview-skeleton';

export const Route = createFileRoute('/_admin/overview')({
  pendingComponent: PlatformOverviewSkeleton,
  component: PlatformOverview,
});
