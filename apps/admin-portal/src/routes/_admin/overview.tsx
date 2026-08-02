import { createFileRoute } from '@tanstack/react-router';
import { PlatformOverview } from '@/features/platform/overview';

export const Route = createFileRoute('/_admin/overview')({
  component: PlatformOverview,
});
