import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * CVs are the profile's first section now, not a page. The address stays so that a bookmark, an
 * old notification email or a link somebody shared still arrives somewhere.
 */
export const Route = createFileRoute('/_account/cvs')({
  beforeLoad: () => {
    throw redirect({ to: '/profile', replace: true });
  },
});
