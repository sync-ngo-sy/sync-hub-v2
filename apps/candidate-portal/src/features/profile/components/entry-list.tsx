import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import { type LucideIcon, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { MAX_ENTRIES } from '../schemas/profile';

interface EntryListProps {
  ids: string[];
  label: (index: number) => string;
  icon: LucideIcon;
  addLabel: string;
  empty: string;
  variant?: 'default' | 'compact-grid';
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: (index: number) => ReactNode;
}

export function EntryList({
  ids,
  label,
  icon,
  addLabel,
  empty,
  variant = 'default',
  onAdd,
  onRemove,
  children,
}: EntryListProps) {
  const compact = variant === 'compact-grid';
  const add = (
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
  );

  if (ids.length === 0) return <EmptyState icon={icon} message={empty} action={add} />;

  return (
    <div className="space-y-4">
      <div
        className={
          compact
            ? 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3'
            : 'space-y-4'
        }
      >
        {ids.map((id, index) => {
          const removeButton = (
            <Button
              type="button"
              variant="destructive-outline"
              size={compact ? 'icon-xs' : 'sm'}
              className={compact ? 'absolute top-2 right-2' : undefined}
              aria-label={`Remove ${label(index)}`}
              onClick={() => onRemove(index)}
            >
              <Trash2 data-icon={compact ? undefined : 'inline-start'} />
              {compact ? null : 'Remove'}
            </Button>
          );
          return (
            <fieldset
              key={id}
              aria-label={label(index)}
              className={
                compact
                  ? 'relative min-w-0 space-y-3 rounded-lg border border-border p-3'
                  : 'min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4'
              }
            >
              {compact ? (
                removeButton
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-dense font-medium text-foreground">{label(index)}</h3>
                  {removeButton}
                </div>
              )}
              {children(index)}
            </fieldset>
          );
        })}
      </div>
      {add}
    </div>
  );
}
