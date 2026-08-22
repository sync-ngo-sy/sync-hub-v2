import { Button } from '@sync/ui/components/ui/button';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Label } from '@sync/ui/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sync/ui/components/ui/tooltip';
import { useId } from 'react';
import {
  ENDED_STATUSES,
  OPEN_STATUSES,
  PIPELINE_STATUSES,
  type PipelineStatus,
  pipelineState,
  type StatusCounts,
  showsEveryStage,
  showsOpenStages,
} from '../application';

const GROUPS = [
  { legend: 'Still deciding', stages: OPEN_STATUSES },
  { legend: 'Ended', stages: ENDED_STATUSES },
] as const;

interface ApplicationPipelineFilterProps {
  selection: PipelineStatus[];
  counts: StatusCounts;
  onChange: (selection: PipelineStatus[]) => void;
}

/**
 * The stages a list is showing, as a facet per stage rather than a strip of tabs.
 *
 * Two gestures on each row, because a reader wants both and a tab strip only ever offered one:
 * the box adds a stage to what is on screen, and `Only` replaces the whole selection with that
 * one stage — which is the click the tabs used to be, kept as a single click. `Open` and `All`
 * are the two old tabs that were never stages at all.
 */
export function ApplicationPipelineFilter({
  selection,
  counts,
  onChange,
}: ApplicationPipelineFilterProps) {
  const boxes = useId();

  function toggle(status: PipelineStatus) {
    onChange(
      selection.includes(status)
        ? selection.filter((each) => each !== status)
        : [...selection, status],
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Button
          variant={showsOpenStages(selection) ? 'default' : 'outline'}
          size="sm"
          className="h-7 flex-1"
          onClick={() => onChange([...OPEN_STATUSES])}
        >
          Open
        </Button>
        <Button
          variant={showsEveryStage(selection) ? 'default' : 'outline'}
          size="sm"
          className="h-7 flex-1"
          onClick={() => onChange([...PIPELINE_STATUSES])}
        >
          All
        </Button>
      </div>

      {GROUPS.map(({ legend, stages }) => (
        <fieldset key={legend}>
          <legend className="mb-2 font-semibold text-meta uppercase tracking-wide text-muted-foreground">
            {legend}
          </legend>
          <div className="space-y-1">
            {stages.map((status) => (
              <div key={status} className="group flex items-center gap-2.5 py-0.5">
                <Checkbox
                  id={`${boxes}-${status}`}
                  checked={selection.includes(status)}
                  onCheckedChange={() => toggle(status)}
                />
                <Label
                  htmlFor={`${boxes}-${status}`}
                  className="flex flex-1 items-center justify-between gap-3 text-dense font-normal"
                >
                  {pipelineState(status).label}{' '}
                  <span className="font-mono tabular-nums text-meta text-muted-foreground">
                    {counts[status] ?? 0}
                  </span>
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Show only ${pipelineState(status).label}`}
                        className="cursor-pointer rounded-sm px-1.5 py-0.5 text-meta font-medium text-accent-foreground opacity-0 outline-none group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => onChange([status])}
                      />
                    }
                  >
                    Only
                  </TooltipTrigger>
                  <TooltipContent side="left">{`Show this stage on its own`}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
