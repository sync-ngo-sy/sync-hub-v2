import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import {
  type SettingsTab,
  WorkspaceSettingsPage,
} from '@/features/tenant/components/workspace-settings-page';
import { WorkspaceSettingsSkeleton } from '@/features/tenant/components/workspace-settings-skeleton';
import { pageTitle } from '@/lib/page-title';

const settingsTab = z.enum(['team', 'tags', 'tenant']);

export const Route = createFileRoute('/_workspace/settings')({
  validateSearch: z.object({ tab: settingsTab.optional().catch(undefined) }),
  head: () => ({ meta: [{ title: pageTitle('Settings') }] }),
  pendingComponent: WorkspaceSettingsSkeleton,
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
