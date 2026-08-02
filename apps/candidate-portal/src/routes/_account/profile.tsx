import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { ProfileEditor } from '@/features/profile/components/profile-editor';
import { myProfileQuery } from '@/features/profile/hooks/use-my-profile';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/profile')({
  head: () => ({ meta: [{ title: pageTitle('Profile') }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myProfileQuery),
      warmReferenceData(context.queryClient),
    ]),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="What recruiters see when you apply. Saved all at once."
      />
      <ProfileEditor />
    </div>
  );
}
