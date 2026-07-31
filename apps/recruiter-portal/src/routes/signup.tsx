import { EmptyState } from '@sync/ui/components/empty-state';
import { createFileRoute } from '@tanstack/react-router';
import { Building2 } from 'lucide-react';
import { PublicHeader } from '@/features/shell/components/public-header';
import { pageTitle } from '@/lib/page-title';

// A stand-in until tenant sign-up ships in its own ticket.
export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: pageTitle('Create your workspace') }] }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
        <EmptyState
          icon={<Building2 />}
          title="Workspace sign-up is coming"
          description="Creating your workspace and confirming your account ships in its own ticket."
        />
      </main>
    </div>
  );
}
