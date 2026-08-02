import { createFileRoute, redirect } from '@tanstack/react-router';

/** CVs are the profile's first section now; the address stays so a bookmark still arrives. */
export const Route = createFileRoute('/_account/cvs')({
  beforeLoad: () => {
    throw redirect({ to: '/profile', replace: true });
  },
});
