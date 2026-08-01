import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PublicHeader } from '@/features/shell/components/public-header';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: pageTitle('Create your workspace') }] }),
  component: SignUpPage,
});

/** Provisional: #61 builds tenant sign-up, teammate invites and recovery. The landing's CTAs need
 * the destination to exist. */
function SignUpPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12 text-center">
        <div className="space-y-1.5">
          <h1 className="font-heading text-h3 text-foreground">Create your workspace</h1>
          <p className="text-dense text-muted-foreground">
            Workspace sign-up arrives with its own ticket.
          </p>
        </div>
        <div>
          <Button variant="outline" render={<Link to="/" />}>
            Back to the landing page
          </Button>
        </div>
      </main>
    </div>
  );
}
