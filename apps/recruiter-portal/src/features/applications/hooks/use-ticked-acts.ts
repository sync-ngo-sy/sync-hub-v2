import { useState } from 'react';
import { toast } from 'sonner';
import type { PipelineStatus } from '../application';
import {
  actedMessage,
  actsOpenTo,
  type Moved,
  type TickedAct,
  tickable,
  whatItSwept,
  whereTickedRowsGo,
} from '../ending';
import { useMoveTickedApplications } from './use-application-actions';

interface TickedRow {
  id: string;
  status: PipelineStatus;
}

export function useTickedActs<TRow extends TickedRow>(rows: TRow[]) {
  const moving = useMoveTickedApplications();
  const [ticked, setTicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<TickedAct | null>(null);
  const tickedRows = rows.filter((row) => ticked.includes(row.id));
  const acts = actsOpenTo(tickedRows.map((row) => row.status));

  async function confirm(chosen: string[]): Promise<Moved> {
    if (!confirming) throw new Error('no act is waiting to be confirmed');
    const swept = await moving.mutateAsync({
      body: { ids: chosen, to: whereTickedRowsGo(confirming) },
    });
    const done = whatItSwept(swept);
    setConfirming(null);
    setTicked([]);
    toast.success(actedMessage(confirming, done, chosen.length));
    return done;
  }

  return {
    ids: tickedRows.map((row) => row.id),
    count: tickedRows.length,
    acts,
    confirming,
    can: (row: TRow) => tickable(row.status, acts),
    onTick: setTicked,
    onAct: setConfirming,
    onConfirm: confirm,
    onClose: () => setConfirming(null),
    clear: () => setTicked([]),
  };
}
