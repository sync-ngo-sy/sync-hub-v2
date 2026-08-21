import { Button } from '@sync/ui/components/ui/button';
import { useLogOut } from '@/features/auth/hooks/use-log-out';
import { CenteredScreen } from '@/features/shell/components/centered-screen';
import type { AccessRefusal } from '../refusal';

const TURNED_OFF_EXPLANATION =
  'An admin turned off your access to this workspace. Ask one of your Tenant’s admins to give it back.';

const SUSPENDED_EXPLANATION =
  'Sync Hub has suspended this Tenant, so nobody on your team can open the workspace. One of your Tenant’s admins can ask Sync Hub to restore it.';

export function AccessRefusedScreen({ refusal }: { refusal: AccessRefusal }) {
  const logOut = useLogOut();

  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">You cannot open this workspace</h1>
      <p className="text-dense text-muted-foreground">
        {refusal === 'tenant-suspended' ? SUSPENDED_EXPLANATION : TURNED_OFF_EXPLANATION}
      </p>
      <p className="text-dense text-muted-foreground">
        You are still signed in, and nothing about your account has changed.
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
