import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { ProfileEditor } from '@/features/profile/components/profile-editor';
import { myProfileQuery } from '@/features/profile/hooks/use-my-profile';
import { profileSearchSchema } from '@/features/profile/search';
import { warmReferenceData } from '@/features/reference/reference-queries';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { pageTitle } from '@/lib/page-title';

// PROTOTYPE for #369 — throwaway. `?variant=A|B|C` swaps the editor for the fill-question
// variants; both this and `features/profile/prototype/` go when the question is settled.
const FillQuestionPrototype = import.meta.env.DEV
  ? lazy(() => import('@/features/profile/prototype/update-question-prototype'))
  : null;

export const Route = createFileRoute('/_account/profile')({
  validateSearch: profileSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Profile') }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myProfileQuery),
      warmReferenceData(context.queryClient),
    ]),
  component: ProfilePage,
});

function ProfilePage() {
  const { variant } = Route.useSearch();

  return (
    <div className="space-y-(--space-section)">
      <PageHeader title="Profile" description="What recruiters see when you apply." />
      {FillQuestionPrototype && variant ? (
        <Suspense fallback={<PageSkeleton />}>
          <FillQuestionPrototype variant={variant} />
        </Suspense>
      ) : (
        <ProfileEditor />
      )}
    </div>
  );
}
