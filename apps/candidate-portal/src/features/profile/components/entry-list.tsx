import { Button } from '@sync/ui/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { MAX_ENTRIES } from '../schemas/profile';

interface EntryListProps {
  /** The keys `useFieldArray` hands out, so an entry keeps its inputs while its neighbours move. */
  ids: string[];
  /** Names one entry — "Job 2" — for its heading and for its Remove button. */
  label: (index: number) => string;
  addLabel: string;
  empty: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: (index: number) => ReactNode;
}

export function EntryList({
  ids,
  label,
  addLabel,
  empty,
  onAdd,
  onRemove,
  children,
}: EntryListProps) {
  return (
    <div className="space-y-4">
      {ids.length === 0 ? <p className="text-dense text-muted-foreground">{empty}</p> : null}

      {ids.map((id, index) => (
        <fieldset
          key={id}
          aria-label={label(index)}
          className="min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-dense font-medium text-foreground">{label(index)}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${label(index)}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 data-icon="inline-start" />
              Remove
            </Button>
          </div>
          {children(index)}
        </fieldset>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        disabled={ids.length >= MAX_ENTRIES}
      >
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  );
}
