import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import { SearchX } from 'lucide-react';
import { NOTHING_MATCHES } from '../job';

export function NothingMatches({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      message={NOTHING_MATCHES}
      action={
        <Button variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}
