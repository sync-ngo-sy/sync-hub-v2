import { PageHeader } from '@sync/ui/components/page-header';
import { Tabs, TabsContent } from '@sync/ui/components/ui/tabs';
import { TagVocabulary } from '@/features/crm/components/tag-vocabulary';
import { ManatalMigrationPanel } from '@/features/manatal-migration/components/manatal-migration-panel';
import { LineTabsList } from '@/features/shell/components/line-tabs-list';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { TeamRoster } from '@/features/team/components/team-roster';
import { WorkspaceIdentity } from './workspace-identity';

export type SettingsTab = 'team' | 'tags' | 'tenant' | 'migration';

interface WorkspaceSettingsPageProps {
  profileId: string;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function WorkspaceSettingsPage({ profileId, tab, onTabChange }: WorkspaceSettingsPageProps) {
  return (
    <Tabs
      className="gap-0"
      value={tab}
      onValueChange={(value) => onTabChange(value as SettingsTab)}
    >
      <WorkspaceHeader withTabs>
        <PageHeader
          title="Settings"
          description="Your team, the Tags they file by, the Tenant they all work for, and the Manatal import."
        />
        <LineTabsList
          label="Workspace settings"
          value={tab}
          tabs={[
            { value: 'team', label: 'Team' },
            { value: 'tags', label: 'Tags' },
            { value: 'tenant', label: 'Tenant' },
            { value: 'migration', label: 'Manatal import' },
          ]}
          className="-mb-px mt-5"
        />
      </WorkspaceHeader>

      <div className="pt-(--space-section)">
        <TabsContent value="team">
          <WidgetBoundary name="The team">
            <TeamRoster profileId={profileId} />
          </WidgetBoundary>
        </TabsContent>
        <TabsContent value="tags">
          <WidgetBoundary name="The Tag vocabulary">
            <TagVocabulary />
          </WidgetBoundary>
        </TabsContent>
        <TabsContent value="tenant">
          <WidgetBoundary name="Your Tenant">
            <WorkspaceIdentity profileId={profileId} />
          </WidgetBoundary>
        </TabsContent>
        <TabsContent value="migration">
          <WidgetBoundary name="The Manatal import">
            <ManatalMigrationPanel profileId={profileId} />
          </WidgetBoundary>
        </TabsContent>
      </div>
    </Tabs>
  );
}
