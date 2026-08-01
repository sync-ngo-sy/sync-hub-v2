import { GetStarted } from './get-started';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { LandingFooter } from './landing-footer';
import { LandingHeader } from './landing-header';
import { WhatYouGet } from './what-you-get';

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <WhatYouGet />
        <HowItWorks />
        <GetStarted />
      </main>
      <LandingFooter />
    </div>
  );
}
