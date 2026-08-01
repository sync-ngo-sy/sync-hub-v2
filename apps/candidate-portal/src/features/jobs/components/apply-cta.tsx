import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';

const INLINE_LINK = 'font-medium text-accent-foreground underline underline-offset-4';

/**
 * The way into applying. Submitting itself is #55's; what a Job page owes a visitor today is the
 * door — and for anyone signed out that door is sign-in, which brings them back here after.
 */
export function ApplyCta({ signedIn, returnTo }: { signedIn: boolean; returnTo: string }) {
  if (signedIn) {
    return (
      <div className="space-y-2.5">
        <Button size="lg" disabled>
          Apply
        </Button>
        <p className="text-meta text-muted-foreground">
          The application form arrives with its own ticket.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Link to="/login" search={{ returnTo }} className={buttonVariants({ size: 'lg' })}>
        Sign in to apply
      </Link>
      <p className="text-meta text-muted-foreground">
        New to Sync?{' '}
        <Link to="/signup" className={INLINE_LINK}>
          Create an account
        </Link>{' '}
        — you come straight back to this role.
      </p>
    </div>
  );
}
