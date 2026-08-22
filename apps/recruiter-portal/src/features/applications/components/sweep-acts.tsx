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
  reading: string;
  onSweep: (to: PipelineStatus) => Promise<SweptApplications>;
}

export function SweepActs({ scope, reading, onSweep }: SweepActsProps) {
  const [confirming, setConfirming] = useState<PipelineStatus | null>(null);
  const destinations = sweepDestinations();
  const nothingToDo = scope.movable === 0;

  return (
    <div className="space-y-3 rounded-md border border-accent-foreground/25 bg-accent/30 p-3">
      <p className="font-mono text-page-title tabular-nums leading-none">{scope.movable}</p>
      <p className="text-meta text-muted-foreground">{sweepScopeMessage(scope)}</p>
      <p className="text-meta font-medium text-foreground">{reading}</p>

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
          reading={reading}
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
  reading: string;
  onConfirm: () => Promise<SweptApplications>;
  onClose: () => void;
}

function SweepConfirm({ to, total, reading, onConfirm, onClose }: SweepConfirmProps) {
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

        <p className="text-meta text-muted-foreground">{reading}</p>

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
