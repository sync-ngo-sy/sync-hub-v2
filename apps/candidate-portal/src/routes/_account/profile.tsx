import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/profile')({
  head: () => ({ meta: [{ title: pageTitle('Profile') }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return <PlaceholderPage title="Profile" description="What recruiters see when you apply." />;
}
