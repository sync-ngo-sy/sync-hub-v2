import { Button } from '@sync/ui/components/ui/button';
import { Checkbox } from '@sync/ui/components/ui/checkbox';
import { Label } from '@sync/ui/components/ui/label';
import { ListFilter } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import type { PipelineStatus, ScreeningVerdict, StatusCounts, VerdictCounts } from '../application';
import { SCREENING_VERDICTS, screeningState } from '../application';
import { ApplicationPipelineFilter } from './application-pipeline-filter';

interface ApplicationsFilterRailProps {
  pipeline: PipelineStatus[];
  onPipelineChange: (selection: PipelineStatus[]) => void;
  screening: ScreeningVerdict[];
  onScreeningChange: (verdicts: ScreeningVerdict[]) => void;
  counts: StatusCounts;
  verdictCounts: VerdictCounts;
  /** Anything else a list narrows by — the Tenant-wide one has a Received window. */
  extra?: ReactNode;
  /** The acts that reach the whole Reading, which belong in here rather than beside the table. */
  acts: ReactNode;
}

/**
 * Everything that decides which Applications are on screen, in one panel — and, at the foot of it,
 * the acts that reach all of them.
 *
 * Pipeline and Screening are the same kind of control here, which is the point: a sweep can act on
 * exactly what the panel describes, so its confirm has nothing left to ask about which
 * Applications it means.
 */
export function ApplicationsFilterRail({
  pipeline,
  onPipelineChange,
  screening,
  onScreeningChange,
  counts,
  verdictCounts,
  extra,
  acts,
}: ApplicationsFilterRailProps) {
  const boxes = useId();
  const theOnlyOne = screening.length === 1 ? screening[0] : undefined;

  return (
    <aside
      aria-label="Filters"
      className="h-fit space-y-5 rounded-lg border border-border bg-card p-(--space-card) shadow-card lg:sticky lg:top-4"
    >
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ListFilter aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="font-semibold text-dense text-foreground">Filters</h2>
      </div>

      <ApplicationPipelineFilter selection={pipeline} counts={counts} onChange={onPipelineChange} />

      <fieldset>
        <legend className="mb-2 font-semibold text-meta uppercase tracking-wide text-muted-foreground">
          Screening
        </legend>
        <Button
          variant={screening.length === SCREENING_VERDICTS.length ? 'default' : 'outline'}
          size="sm"
          className="mb-2 h-7 w-full"
          onClick={() => onScreeningChange([...SCREENING_VERDICTS])}
        >
          All verdicts
        </Button>
        <div className="space-y-1">
          {SCREENING_VERDICTS.map((verdict) => (
            <div key={verdict} className="flex items-center gap-2.5 py-0.5">
              <Checkbox
                id={`${boxes}-${verdict}`}
                checked={screening.includes(verdict)}
                disabled={theOnlyOne === verdict}
                onCheckedChange={() =>
                  onScreeningChange(
                    screening.includes(verdict)
                      ? screening.filter((each) => each !== verdict)
                      : [...screening, verdict],
                  )
                }
              />
              <Label
                htmlFor={`${boxes}-${verdict}`}
                className="flex flex-1 items-center justify-between gap-3 text-dense font-normal"
              >
                {screeningState(verdict).label}{' '}
                <span className="font-mono tabular-nums text-meta text-muted-foreground">
                  {verdictCounts[verdict] ?? 0}
                </span>
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      {extra}

      {acts}
    </aside>
  );
}
