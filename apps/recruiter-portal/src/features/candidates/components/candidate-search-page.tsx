import { PageHeader } from '@sync/ui/components/page-header';
import { Tabs, TabsContent } from '@sync/ui/components/ui/tabs';
import { LineTabsList } from '@/features/shell/components/line-tabs-list';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import type { CandidateSearchFilters, CandidateTab, DirectoryOrder } from '../search';
import { CandidateDirectory } from './candidate-directory';
import { CandidateFilters } from './candidate-filters';
import { CandidateResults } from './candidate-results';

const DESCRIPTION =
  'Every Candidate on the platform who has opted into being found, not only the ones who applied to you. Open anyone to read their whole profile, contact details included.';

const AI_HINT =
  'These results are ranked by AI relevance and may be imperfect. Use the Filter tab when you need exact matching.';

interface CandidateSearchPageProps {
  tab: CandidateTab;
  order: DirectoryOrder;
  filters: CandidateSearchFilters;
  onTabChange: (tab: CandidateTab) => void;
  onOrderChange: (order: DirectoryOrder) => void;
  onFiltersChange: (filters: CandidateSearchFilters) => void;
}

export function CandidateSearchPage({
  tab,
  order,
  filters,
  onTabChange,
  onOrderChange,
  onFiltersChange,
}: CandidateSearchPageProps) {
  const clear = () => onFiltersChange({ q: filters.q });

  return (
    <Tabs
      className="gap-0"
      value={tab}
      onValueChange={(next) => onTabChange(next as CandidateTab)}
    >
      <WorkspaceHeader withTabs>
        <PageHeader title="Candidates" description={DESCRIPTION} />
        <LineTabsList
          label="Candidate search"
          value={tab}
          tabs={[
            { value: 'filter', label: 'Filter' },
            { value: 'search', label: 'AI Search' },
          ]}
          className="-mb-px mt-5"
        />
      </WorkspaceHeader>

      <div className="pt-(--space-section)">
        <TabsContent value="filter" className="space-y-(--space-section)">
          <CandidateFilters tab="filter" filters={filters} onSearch={onFiltersChange} />

          <WidgetBoundary name="Directory">
            <CandidateDirectory
              filters={filters}
              order={order}
              onOrderChange={onOrderChange}
              onClear={clear}
            />
          </WidgetBoundary>
        </TabsContent>

        <TabsContent value="search" className="space-y-(--space-section)">
          <p className="text-meta text-muted-foreground">{AI_HINT}</p>

          <CandidateFilters tab="search" filters={filters} onSearch={onFiltersChange} />

          <WidgetBoundary name="Search results">
            <CandidateResults filters={filters} onClear={clear} />
          </WidgetBoundary>
        </TabsContent>
      </div>
    </Tabs>
  );
}
