import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PublicHeader } from '@/features/shell/components/public-header';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Sync Recruiter' }] }),
  component: LandingPage,
});

/** Stands in for the Recruiter landing page until its own ticket builds it. */
function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-5 py-16">
        <h1 className="font-heading text-h1 text-foreground">Hiring, in one clear place.</h1>
        <p className="max-w-prose text-base text-muted-foreground">
          Sync Recruiter is where companies publish jobs, screen applicants, and work their
          pipeline.
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
