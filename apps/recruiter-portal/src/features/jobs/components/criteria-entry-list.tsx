import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import { type LucideIcon, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { MAX_CRITERIA_ENTRIES } from '../schemas/criteria';

interface CriteriaEntryListProps {
  ids: string[];
  label: (index: number) => string;
  icon: LucideIcon;
  addLabel: string;
  empty: string;
  disabled: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: (index: number) => ReactNode;
}

export function CriteriaEntryList({
  ids,
  label,
  icon,
  addLabel,
  empty,
  disabled,
  onAdd,
  onRemove,
  children,
}: CriteriaEntryListProps) {
  const add = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || ids.length >= MAX_CRITERIA_ENTRIES}
      onClick={onAdd}
    >
      <Plus data-icon="inline-start" />
      {addLabel}
    </Button>
  );

  if (ids.length === 0) return <EmptyState icon={icon} message={empty} action={add} />;

  return (
    <div className="space-y-4">
      {ids.map((id, index) => (
        <fieldset
          key={id}
          aria-label={label(index)}
          disabled={disabled}
          className="min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-dense font-medium text-foreground">{label(index)}</h3>
            <Button
              type="button"
              variant="destructive-outline"
              size="sm"
              aria-label={`Remove ${label(index)}`}
              disabled={disabled}
              onClick={() => onRemove(index)}
            >
              <Trash2 data-icon="inline-start" />
              Remove
            </Button>
          </div>
          {children(index)}
        </fieldset>
      ))}
      {add}
    </div>
  );
}
