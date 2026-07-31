import { createFileRoute } from '@tanstack/react-router';
import { Capabilities } from '@/features/landing/components/capabilities';
import { ContactBand } from '@/features/landing/components/contact-band';
import { Hero } from '@/features/landing/components/hero';
import { HowItWorks } from '@/features/landing/components/how-it-works';
import { LandingFooter } from '@/features/landing/components/landing-footer';
import { LandingNav } from '@/features/landing/components/landing-nav';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Sync for employers' }] }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Capabilities />
        <ContactBand />
      </main>
      <LandingFooter />
    </div>
  );
}
