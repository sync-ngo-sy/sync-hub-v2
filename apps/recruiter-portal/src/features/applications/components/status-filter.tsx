import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { PIPELINE_STATUSES, type PipelineStatus, pipelineState } from '../application';
import type { StatusCounts } from '../hooks/use-job-applications';

interface StatusFilterProps {
  selected: PipelineStatus[];
  counts: StatusCounts;
  onChange: (selected: PipelineStatus[]) => void;
}

function theOnlyOne(selected: PipelineStatus[]): PipelineStatus | undefined {
  const [first, ...rest] = selected;
  return rest.length === 0 ? first : undefined;
}

function summarize(selected: PipelineStatus[]): string {
  if (selected.length === PIPELINE_STATUSES.length) return 'All statuses';
  const only = theOnlyOne(selected);
  return only ? pipelineState(only).label : `${selected.length} statuses`;
}

export function StatusFilter({ selected, counts, onChange }: StatusFilterProps) {
  const only = theOnlyOne(selected);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="shrink-0 text-meta text-muted-foreground">
        Pipeline
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Pipeline: ${summarize(selected)}`}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-sm font-medium whitespace-nowrap outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {summarize(selected)}
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => onChange([...PIPELINE_STATUSES])}>
            All statuses
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {PIPELINE_STATUSES.map((status) => (
            <DropdownMenuCheckboxItem
              key={status}
              className="pr-10"
              aria-label={`${pipelineState(status).label}, ${counts[status] ?? 0}`}
              checked={selected.includes(status)}
              disabled={only === status}
              onCheckedChange={(checked) =>
                onChange(
                  PIPELINE_STATUSES.filter((one) =>
                    one === status ? checked : selected.includes(one),
                  ),
                )
              }
            >
              <span className="flex-1">{pipelineState(status).label}</span>
              <span className="text-meta tabular-nums text-muted-foreground">
                {counts[status] ?? 0}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
