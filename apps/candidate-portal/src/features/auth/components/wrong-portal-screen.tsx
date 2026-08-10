import type { components } from '@sync/api-client';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { CenteredScreen } from '@/features/shell/components/centered-screen';
import { env } from '@/lib/env';
import { useLogOut } from '../hooks/use-log-out';

type AccountType = components['schemas']['AccountType'];

const RECRUITER_EXPLANATION =
  "You're signed in with a recruiter account. Jobs, applications and your team live in the Sync Hub Recruiter Portal. Sign out here to use a candidate account instead.";

const PLATFORM_ADMIN_EXPLANATION =
  "You're signed in with a platform admin account, which this portal does not serve. Sign out here to use a candidate account instead.";

export function WrongPortalScreen({ accountType }: { accountType: AccountType }) {
  const logOut = useLogOut();

  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">This is the Candidate Portal</h1>
      <p className="text-muted-foreground">
        {accountType === 'platform_admin' ? PLATFORM_ADMIN_EXPLANATION : RECRUITER_EXPLANATION}
      </p>
      <div className="flex justify-center gap-2">
        {accountType === 'platform_admin' && (
          <a href={env.adminPortalUrl} className={buttonVariants()}>
            Go to Admin Portal
          </a>
        )}
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
