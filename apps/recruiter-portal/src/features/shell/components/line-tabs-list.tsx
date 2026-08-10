import { TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { cn } from '@sync/ui/lib/utils';

export interface LineTab {
  value: string;
  label: string;
  count?: number;
}

interface LineTabsListProps {
  label: string;
  value: string;
  tabs: readonly LineTab[];
  className?: string;
}

export function LineTabsList({ label, value, tabs, className }: LineTabsListProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <TabsList
        variant="line"
        aria-label={label}
        className="min-w-max justify-start gap-7 p-0 group-data-horizontal/tabs:h-10"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            aria-label={tab.count === undefined ? tab.label : `${tab.label} ${tab.count}`}
            className="h-10 flex-none rounded-none px-0 py-0 after:hidden"
          >
            <span
              className={cn(
                'relative flex h-full items-center after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0',
                value === tab.value && 'after:opacity-100',
              )}
            >
              {tab.label}
            </span>
            {tab.count !== undefined ? (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-meta text-muted-foreground tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
