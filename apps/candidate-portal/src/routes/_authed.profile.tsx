import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { ProfileEditorForm } from '../features/profile/components/profile-editor-form';
import { myProfileQueryOptions, useMyProfile } from '../features/profile/hooks/use-my-profile';

export const Route = createFileRoute('/_authed/profile')({
  loader: ({ context }) => context.queryClient.ensureQueryData(myProfileQueryOptions),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useMyProfile();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Profile" description="Everything a future application will reflect." />
      {profile ? <ProfileEditorForm profile={profile} /> : null}
    </div>
  );
}
