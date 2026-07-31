import { createFileRoute } from '@tanstack/react-router';
import { HEADLINE_TEXT } from '@/features/landing/components/headline';
import { LandingPage } from '@/features/landing/components/landing-page';
import { PORTAL_TITLE } from '@/lib/page-title';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: `${PORTAL_TITLE} — ${HEADLINE_TEXT}` }] }),
  component: LandingPage,
});
