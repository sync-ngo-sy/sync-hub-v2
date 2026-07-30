import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { UserPlus } from 'lucide-react';

export const Route = createFileRoute('/_shell/signup')({
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-sm flex-1 space-y-6 px-4 py-16">
      <PageHeader title="Create your profile" description="Apply once, follow every step." />
      <EmptyState
        icon={<UserPlus />}
        title="Sign-up is coming"
        description="Creating an account and confirming your email ships in its own ticket."
      />
    </div>
  );
}
