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
  entryClassName?: string;
  hideLabel?: boolean;
  listClassName?: string;
  removeIconOnly?: boolean;
  removeOverlay?: boolean;
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
  entryClassName,
  hideLabel = false,
  listClassName,
  removeIconOnly = false,
  removeOverlay = false,
  onAdd,
  onRemove,
  children,
}: EntryListProps) {
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
      <div className={listClassName ?? 'space-y-4'}>
        {ids.map((id, index) => (
          <fieldset
            key={id}
            aria-label={label(index)}
            className={
              entryClassName ?? 'min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4'
            }
          >
            {removeOverlay ? (
              <Button
                type="button"
                variant="ghost"
                size={removeIconOnly ? 'icon-xs' : 'sm'}
                className="absolute top-2 right-2"
                aria-label={`Remove ${label(index)}`}
                onClick={() => onRemove(index)}
              >
                <Trash2 data-icon={removeIconOnly ? undefined : 'inline-start'} />
                {removeIconOnly ? null : 'Remove'}
              </Button>
            ) : (
              <div
                className={`flex items-center gap-3 ${hideLabel ? 'justify-end' : 'justify-between'}`}
              >
                {hideLabel ? null : (
                  <h3 className="text-dense font-medium text-foreground">{label(index)}</h3>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size={removeIconOnly ? 'icon-xs' : 'sm'}
                  aria-label={`Remove ${label(index)}`}
                  onClick={() => onRemove(index)}
                >
                  <Trash2 data-icon={removeIconOnly ? undefined : 'inline-start'} />
                  {removeIconOnly ? null : 'Remove'}
                </Button>
              </div>
            )}
            {children(index)}
          </fieldset>
        ))}
      </div>
      {add}
    </div>
  );
}
