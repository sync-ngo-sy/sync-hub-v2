import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireCandidate } from '../lib/auth';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const profile = await requireCandidate(context.queryClient, location.href);
    return { profile };
  },
  component: () => <Outlet />,
});
