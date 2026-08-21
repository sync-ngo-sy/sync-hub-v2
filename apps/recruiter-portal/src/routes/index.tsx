import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/features/landing/components/landing-page';
import { LandingSkeleton } from '@/features/landing/components/landing-skeleton';
import { HEADLINE_TEXT } from '@/features/landing/headline';
import { landingTitle } from '@/lib/page-title';
import { bounceSignedIn } from './-public-only';

export const Route = createFileRoute('/')({
  beforeLoad: bounceSignedIn,
  head: () => ({ meta: [{ title: landingTitle(HEADLINE_TEXT) }] }),
  pendingComponent: LandingSkeleton,
  component: LandingPage,
});
