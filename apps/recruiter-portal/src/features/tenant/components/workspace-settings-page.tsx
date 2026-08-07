import { PageHeader } from '@sync/ui/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { TagVocabulary } from '@/features/crm/components/tag-vocabulary';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { TeamRoster } from '@/features/team/components/team-roster';
import { WorkspaceIdentity } from './workspace-identity';

export type SettingsTab = 'team' | 'tags' | 'tenant';

interface WorkspaceSettingsPageProps {
  profileId: string;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function WorkspaceSettingsPage({ profileId, tab, onTabChange }: WorkspaceSettingsPageProps) {
  return (
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Settings"
        description="Your team, the Tags they file by, and the Tenant they all work for."
      />

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as SettingsTab)}>
        <TabsList aria-label="Workspace settings">
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="tenant">Tenant</TabsTrigger>
        </TabsList>
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
            <WorkspaceIdentity />
          </WidgetBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
