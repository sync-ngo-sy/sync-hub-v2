import type { components } from '@sync/api-client';
import { Button } from '@sync/ui/components/ui/button';
import { CenteredScreen } from '@/features/shell/components/centered-screen';
import { useLogOut } from '../hooks/use-log-out';

type AccountType = components['schemas']['AccountType'];

const CANDIDATE_EXPLANATION =
  "You're signed in with a candidate account. Jobs, applications and your profile live in the Sync Candidate Portal. Sign out here to use a recruiter account instead.";

const PLATFORM_ADMIN_EXPLANATION =
  "You're signed in with a platform admin account, which this portal does not serve. Sign out here to use a recruiter account instead.";

export function WrongPortalScreen({ accountType }: { accountType: AccountType }) {
  const logOut = useLogOut();

  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">This is the Recruiter Portal</h1>
      <p className="text-dense text-muted-foreground">
        {accountType === 'platform_admin' ? PLATFORM_ADMIN_EXPLANATION : CANDIDATE_EXPLANATION}
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
