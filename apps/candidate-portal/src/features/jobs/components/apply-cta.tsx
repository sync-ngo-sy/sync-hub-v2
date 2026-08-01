import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';

const INLINE_LINK = 'font-medium text-accent-foreground underline underline-offset-4';

/**
 * The way into applying. Submitting an Application is the next ticket's; what a Job page owes a
 * reader today is the door — and for anyone signed out that door is sign-in, which returns here.
 */
export function ApplyCta({ signedIn, returnTo }: { signedIn: boolean; returnTo: string }) {
  if (signedIn) {
    return (
      <div className="space-y-2.5">
        <Button size="lg" disabled>
          Apply
        </Button>
        <p className="text-meta text-muted-foreground">Applying opens here soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Link to="/login" search={{ returnTo }} className={buttonVariants({ size: 'lg' })}>
        Sign in to apply
      </Link>
      {/* Sign-up finishes in the inbox and lands on My Applications, so it cannot promise a
          return here — only signing in can. */}
      <p className="text-meta text-muted-foreground">
        New to Sync?{' '}
        <Link to="/signup" className={INLINE_LINK}>
          Create an account
        </Link>
        .
      </p>
    </div>
  );
}
