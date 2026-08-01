import { EmployerBand } from './employer-band';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { LandingFooter } from './landing-footer';
import { LandingHeader } from './landing-header';
import { NewestJobs } from './newest-jobs';

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <NewestJobs />
        <HowItWorks />
        <EmployerBand />
      </main>
      <LandingFooter />
    </div>
  );
}
