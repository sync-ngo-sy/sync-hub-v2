import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sync/ui/components/ui/alert-dialog';
import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { problemDetail } from '@/lib/api-problem';
import type { PipelineStatus } from '../application';
import {
  type SweepScope,
  type SweptApplications,
  sweepConsequence,
  sweepDestinations,
  sweepLabel,
  sweepRefused,
  sweepScopeMessage,
} from '../ending';

interface SweepActsProps {
  scope: SweepScope;
  /** What the Screening filter leaves out, where it leaves anything out. */
  narrowing: string | null;
  onSweep: (to: PipelineStatus) => Promise<SweptApplications>;
}

/**
 * What the filters beside this add up to, and the acts that reach all of it.
 *
 * The acts sit inside the filter panel on purpose: a sweep acts on exactly the Reading the panel
 * describes, so putting the buttons anywhere else would leave the scope to be explained in words.
 * The count above them is the whole Reading rather than the page on screen, and where the Reading
 * reaches Applications that have ended it says how many of them no act can move.
 */
export function SweepActs({ scope, narrowing, onSweep }: SweepActsProps) {
  const [confirming, setConfirming] = useState<PipelineStatus | null>(null);
  const destinations = Object.entries(sweepDestinations()) as [PipelineStatus, string][];
  const nothingToDo = scope.movable === 0;

  return (
    <div className="space-y-3 rounded-md border border-accent-foreground/25 bg-accent/30 p-3">
      <p className="font-mono text-page-title tabular-nums leading-none">{scope.movable}</p>
      <p className="text-meta text-muted-foreground">{sweepScopeMessage(scope)}</p>
      {narrowing ? <p className="text-meta text-muted-foreground">{narrowing}</p> : null}

      <div className="flex flex-col gap-2 pt-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" disabled={nothingToDo} />}
          >
            Move all to
            <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {destinations.map(([status, label]) => (
              <DropdownMenuItem key={status} onClick={() => setConfirming(status)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          disabled={nothingToDo}
          onClick={() => setConfirming('rejected')}
        >
          End all matching
        </Button>
      </div>

      {confirming ? (
        <SweepConfirm
          to={confirming}
          total={scope.movable}
          narrowing={narrowing}
          onConfirm={() => onSweep(confirming)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

interface SweepConfirmProps {
  to: PipelineStatus;
  total: number;
  narrowing: string | null;
  onConfirm: () => Promise<SweptApplications>;
  onClose: () => void;
}

/**
 * One confirm, and nothing to choose in it.
 *
 * The Reading already says which Applications are being acted on, so this asks nothing about them
 * — where the old modal ticked statuses it was duplicating the Pipeline filter, which is exactly
 * what made a sweep's scope ambiguous.
 */
function SweepConfirm({ to, total, narrowing, onConfirm, onClose }: SweepConfirmProps) {
  const [sweeping, setSweeping] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const label = sweepLabel(to, total);

  function changeOpen(open: boolean) {
    if (open || sweeping) return;
    onClose();
  }

  async function confirm() {
    if (sweeping) return;
    setRefusal(null);
    setSweeping(true);
    try {
      await onConfirm();
    } catch (error) {
      setRefusal(problemDetail(error, sweepRefused(to)));
      setSweeping(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${label}?`}</AlertDialogTitle>
          <AlertDialogDescription>{sweepConsequence(to)}</AlertDialogDescription>
        </AlertDialogHeader>

        {narrowing ? <p className="text-meta text-muted-foreground">{narrowing}</p> : null}

        {refusal ? (
          <Alert variant="destructive">
            <AlertTitle>Nothing moved</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={sweeping}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={to === 'rejected' ? 'destructive' : 'default'}
            disabled={sweeping}
            onClick={() => void confirm()}
          >
            {sweeping ? 'Working…' : label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
