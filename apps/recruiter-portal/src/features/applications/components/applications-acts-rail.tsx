import { Zap } from 'lucide-react';
import type { PipelineStatus } from '../application';
import type { SweepScope, SweptApplications, TickedAct } from '../ending';
import { SweepActs } from './sweep-acts';
import { TickedActs } from './ticked-acts';

export const LIST_BESIDE_RAIL =
  'flex flex-col-reverse gap-(--space-section) lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]';

interface ApplicationsActsRailProps {
  scope: SweepScope;
  reading: string;
  onSweep: (to: PipelineStatus) => Promise<SweptApplications>;
  ticks: {
    count: number;
    acts: TickedAct[];
    onAct: (act: TickedAct) => void;
    clear: () => void;
  };
}

export function ApplicationsActsRail({
  scope,
  reading,
  onSweep,
  ticks,
}: ApplicationsActsRailProps) {
  return (
    <aside
      aria-label="Acts"
      className="h-fit space-y-4 rounded-lg border border-border bg-card p-(--space-card) shadow-card lg:sticky lg:top-4"
    >
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Zap aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="font-semibold text-dense text-foreground">Acts</h2>
      </div>

      <SweepActs scope={scope} reading={reading} onSweep={onSweep} />

      {ticks.count > 0 ? (
        <TickedActs
          ticked={ticks.count}
          acts={ticks.acts}
          onAct={ticks.onAct}
          onClear={ticks.clear}
        />
      ) : null}
    </aside>
  );
}
