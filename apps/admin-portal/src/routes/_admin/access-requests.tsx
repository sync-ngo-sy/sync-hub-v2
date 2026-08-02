import { createFileRoute } from '@tanstack/react-router';
import { AccessRequests } from '@/features/platform/access-requests';

export const Route = createFileRoute('/_admin/access-requests')({
  component: AccessRequests,
});
