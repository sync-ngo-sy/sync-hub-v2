import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { PublicShell } from '@/features/shell/components/public-shell';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: pageTitle('Create your account') }] }),
  component: SignUpPage,
});

/** Provisional: #53 builds sign-up, email confirmation and password recovery. The landing's
 * CTAs need the destination to exist. */
function SignUpPage() {
  return (
    <PublicShell>
      <PlaceholderPage
        title="Create your account"
        description="One profile, every application you send."
      />
    </PublicShell>
  );
}
