import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PublicHeader } from '@/features/shell/components/public-header';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

/** Provisional: the Recruiter landing gets its own ticket. */
function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16 text-center">
        <h1 className="font-heading text-h2 text-foreground">Hiring, in one clear place.</h1>
        <p className="text-muted-foreground">
          Sync Recruiter is where companies publish jobs and review the people who apply.
        </p>
        <div>
          <Button size="lg" render={<Link to="/login" />}>
            Sign in
          </Button>
        </div>
      </main>
    </div>
  );
}
