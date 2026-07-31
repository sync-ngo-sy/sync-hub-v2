import { buttonVariants } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PublicHeader } from '@/features/shell/components/public-header';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

/** Provisional: #52 builds the real Editorial landing, animation and all. */
function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader>
        <Link to="/login" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
          Sign in
        </Link>
      </PublicHeader>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16 text-center">
        <h1 className="font-heading text-h2 text-foreground">Syria's jobs, in one clear place.</h1>
        <div>
          <Link to="/jobs" className={buttonVariants({ size: 'lg' })}>
            Browse jobs
          </Link>
        </div>
      </main>
    </div>
  );
}
