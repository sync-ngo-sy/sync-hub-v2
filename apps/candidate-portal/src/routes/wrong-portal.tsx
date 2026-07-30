import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useLogout } from '../features/auth/hooks/use-logout';
import { loadProfile } from '../lib/auth';

export const Route = createFileRoute('/wrong-portal')({
  beforeLoad: async ({ context, location }) => {
    const profile = await loadProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login', search: { returnTo: location.href } });
    return { profile };
  },
  component: WrongPortalPage,
});

function WrongPortalPage() {
  const { profile } = Route.useRouteContext();
  const logout = useLogout();
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-h2 font-heading text-foreground">Wrong portal</h1>
      <p className="text-muted-foreground">
        {profile.full_name}, this account is a Recruiter account. Head to the Recruiter Portal to
        continue.
      </p>
      <Button variant="outline" onClick={() => void logout()}>
        Log out
      </Button>
    </div>
  );
}
