import { PageHeader } from '@sync/ui/components/page-header';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import type { CandidateSearchFilters } from '../search';
import { CandidateFilters } from './candidate-filters';
import { CandidateResults } from './candidate-results';

const DESCRIPTION =
  'Every Candidate on the platform who has opted into being found, not only the ones who applied to you. Results never carry an address or a phone number.';

interface CandidateSearchPageProps {
  filters: CandidateSearchFilters;
  onFiltersChange: (filters: CandidateSearchFilters) => void;
}

export function CandidateSearchPage({ filters, onFiltersChange }: CandidateSearchPageProps) {
  return (
    <div className="space-y-8">
      <PageHeader title="Candidates" description={DESCRIPTION} />

      <CandidateFilters filters={filters} onSearch={onFiltersChange} />

      <WidgetBoundary name="Search results">
        <CandidateResults filters={filters} onClear={() => onFiltersChange({ q: filters.q })} />
      </WidgetBoundary>
    </div>
  );
}
