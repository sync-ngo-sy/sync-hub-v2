import { Button } from '@sync/ui/components/ui/button';
import { CenteredScreen } from '@/features/shell/components/centered-screen';
import { useLogOut } from '../hooks/use-log-out';

export function WrongPortalScreen() {
  const logOut = useLogOut();

  return (
    <CenteredScreen>
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
    </CenteredScreen>
  );
}
