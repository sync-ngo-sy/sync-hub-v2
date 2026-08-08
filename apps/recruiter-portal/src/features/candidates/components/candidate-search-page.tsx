import { PageHeader } from '@sync/ui/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { Funnel, Sparkles } from 'lucide-react';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import type { CandidateSearchFilters, CandidateTab, DirectoryOrder } from '../search';
import { CandidateDirectory } from './candidate-directory';
import { CandidateFilters } from './candidate-filters';
import { CandidateResults } from './candidate-results';

const DESCRIPTION =
  'Every Candidate on the platform who has opted into being found, not only the ones who applied to you. Results never carry an address or a phone number.';

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
    <div className="space-y-(--space-section)">
      <PageHeader title="Candidates" description={DESCRIPTION} />

      <Tabs value={tab} onValueChange={(next) => onTabChange(next as CandidateTab)}>
        <TabsList>
          <TabsTrigger value="filter">
            <Funnel aria-hidden="true" />
            Filter
          </TabsTrigger>
          <TabsTrigger value="search">
            <Sparkles aria-hidden="true" />
            AI Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filter" className="space-y-(--space-section) pt-4">
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

        <TabsContent value="search" className="space-y-(--space-section) pt-4">
          <p className="text-meta text-muted-foreground">{AI_HINT}</p>

          <CandidateFilters tab="search" filters={filters} onSearch={onFiltersChange} />

          <WidgetBoundary name="Search results">
            <CandidateResults filters={filters} onClear={clear} />
          </WidgetBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
