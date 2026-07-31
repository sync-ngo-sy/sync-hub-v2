import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PublicHeader } from '@/features/shell/components/public-header';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

/** Provisional: #60 designs the real landing. */
function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16 text-center">
        <p className="text-muted-foreground">Sync Recruiter is where companies hire on Sync.</p>
        <div>
          <Button size="lg" render={<Link to="/login" />}>
            Sign in
          </Button>
        </div>
      </main>
    </div>
  );
}
