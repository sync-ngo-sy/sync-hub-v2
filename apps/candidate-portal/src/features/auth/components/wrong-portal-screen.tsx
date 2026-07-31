import { Button } from '@sync/ui/components/ui/button';
import { CenteredScreen } from '@/features/shell/components/centered-screen';
import { useLogOut } from '../hooks/use-log-out';

export function WrongPortalScreen() {
  const logOut = useLogOut();

  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">This is the Candidate Portal</h1>
      <p className="text-muted-foreground">
        You're signed in with a recruiter account. Jobs, applications and your team live in the Sync
        Recruiter Portal. Sign out here to use a candidate account instead.
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
    </CenteredScreen>
  );
}
