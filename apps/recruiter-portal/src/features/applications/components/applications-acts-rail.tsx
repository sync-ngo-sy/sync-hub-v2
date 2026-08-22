import { Zap } from 'lucide-react';
import type { ReactNode } from 'react';

interface ApplicationsActsRailProps {
  /** The acts that reach the whole Reading. */
  sweep: ReactNode;
  /** The acts that reach the ticked rows, where any are ticked. */
  ticked: ReactNode;
}

/**
 * Everything that acts on more than one Application, in one panel beside the list.
 *
 * The two scopes look alike and mean different things — a sweep reaches every Application the
 * filters describe, a tick reaches the rows somebody picked — so they are stated one under the
 * other, each naming what it reaches, rather than left to be told apart by where they sit.
 */
export function ApplicationsActsRail({ sweep, ticked }: ApplicationsActsRailProps) {
  return (
    <aside
      aria-label="Bulk actions"
      className="h-fit space-y-4 rounded-lg border border-border bg-card p-(--space-card) shadow-card lg:sticky lg:top-4"
    >
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Zap aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="font-semibold text-dense text-foreground">Bulk actions</h2>
      </div>

      {sweep}
      {ticked}
    </aside>
  );
}
