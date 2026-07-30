import { createFileRoute } from '@tanstack/react-router';
import { EmployerBand } from '../features/landing/components/employer-band';
import { Hero } from '../features/landing/components/hero';
import { HowItWorks } from '../features/landing/components/how-it-works';
import { JobsIndex } from '../features/landing/components/jobs-index';
import { LandingFooter } from '../features/landing/components/landing-footer';
import { LandingNav } from '../features/landing/components/landing-nav';
import { bounceIfAuthed } from '../lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    await bounceIfAuthed(context.queryClient);
  },
  component: LandingPage,
});

// The Editorial landing: the portal's public voice and its one animated surface. It renders outside
// the `_shell` app frame, so it carries its own nav and footer.
function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <JobsIndex />
        <HowItWorks />
        <EmployerBand />
      </main>
      <LandingFooter />
    </div>
  );
}
