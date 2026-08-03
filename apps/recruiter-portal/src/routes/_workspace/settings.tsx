import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { warmTagVocabulary } from '@/features/crm/hooks/use-tag-vocabulary';
import { warmMembers } from '@/features/team/hooks/use-members';
import {
  type SettingsTab,
  WorkspaceSettingsPage,
} from '@/features/tenant/components/workspace-settings-page';
import { pageTitle } from '@/lib/page-title';

const settingsTab = z.enum(['team', 'tags', 'tenant']);

export const Route = createFileRoute('/_workspace/settings')({
  validateSearch: z.object({ tab: settingsTab.optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  /** Only the tab that is about to be on screen is warmed; the other two read their own
   * endpoints when they are opened. */
  loader: ({ context, deps }) =>
    deps.tab === 'tags' ? warmTagVocabulary(context.queryClient) : warmMembers(context.queryClient),
  head: () => ({ meta: [{ title: pageTitle('Settings') }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile } = Route.useRouteContext();
  const { tab = 'team' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WorkspaceSettingsPage
      profileId={profile.id}
      tab={tab}
      onTabChange={(next: SettingsTab) => void navigate({ search: { tab: next }, replace: true })}
    />
  );
}
