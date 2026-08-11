import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_account/cvs')({
  beforeLoad: () => {
    throw redirect({ to: '/profile', replace: true });
  },
});
