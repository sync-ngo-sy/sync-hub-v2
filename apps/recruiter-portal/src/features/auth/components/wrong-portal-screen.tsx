import { Button } from '@sync/ui/components/ui/button';
import { useLogOut } from '../hooks/use-log-out';

/**
 * A signed-in Candidate who lands here is not forbidden — they are simply in the wrong
 * place, so the screen names the portal that is theirs.
 */
export function WrongPortalScreen() {
  const logOut = useLogOut();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      <h1 className="font-heading text-h3 text-foreground">This is the Recruiter Portal</h1>
      <p className="text-dense text-muted-foreground">
        You're signed in with a candidate account. Jobs, applications and your profile live in the
        Sync Candidate Portal. Sign out here to use a recruiter account instead.
      </p>
      <div>
        <Button
          variant="outline"
          disabled={logOut.isPending}
          onClick={() => {
            logOut.mutate({});
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
