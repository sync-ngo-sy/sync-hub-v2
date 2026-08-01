import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/features/landing/components/landing-page';
import { HEADLINE_TEXT } from '@/features/landing/headline';
import { landingTitle } from '@/lib/page-title';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: landingTitle(HEADLINE_TEXT) }] }),
  component: LandingPage,
});
