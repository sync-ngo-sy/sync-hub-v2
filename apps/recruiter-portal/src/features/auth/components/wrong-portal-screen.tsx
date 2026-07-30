import { Button } from '@sync/ui/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { Brand } from '@/features/shell/components/brand';
import { useLogOut } from '../hooks/use-log-out';

/**
 * A signed-in Candidate opened the Recruiter Portal. Name the portal they belong in and give
 * them the one action that gets them out — never a bare 403.
 */
export function WrongPortalScreen() {
  const logOut = useLogOut();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
      <Brand />
      <h1 className="font-heading text-h3 text-foreground">
        Your account belongs in the Candidate Portal
      </h1>
      <p className="text-sm text-muted-foreground">
        This is the Sync Recruiter Portal, for companies hiring on Sync. You are signed in with a
        candidate account — the Candidate Portal is where you browse and apply to jobs.
      </p>
      <Button variant="outline" disabled={logOut.isPending} onClick={() => logOut.mutate({})}>
        {logOut.isPending ? <LoaderCircle className="animate-spin" /> : null}
        Sign out
      </Button>
    </main>
  );
}
