import { createFileRoute } from '@tanstack/react-router';
import { AccountDeletedScreen } from '@/features/settings/components/account-deleted-screen';
import { CenteredSkeleton } from '@/features/shell/components/centered-skeleton';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/account-deleted')({
  head: () => ({ meta: [{ title: pageTitle('Account deleted') }] }),
  pendingComponent: () => <CenteredSkeleton label="Loading this notice" />,
  component: AccountDeletedScreen,
});
