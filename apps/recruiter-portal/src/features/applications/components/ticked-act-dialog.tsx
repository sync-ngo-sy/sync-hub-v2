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
import { useState } from 'react';
import { problemDetail } from '@/lib/api-problem';
import { actConsequence, actLabel, actRefused, type Moved, type TickedAct } from '../ending';

interface TickedActDialogProps {
  act: TickedAct;
  ticked: string[];
  onConfirm: (ticked: string[]) => Promise<Moved>;
  onClose: () => void;
}

export function TickedActDialog({ act, ticked, onConfirm, onClose }: TickedActDialogProps) {
  const [acting, setActing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const label = actLabel(act, ticked.length);

  function changeOpen(open: boolean) {
    if (open || acting) return;
    onClose();
  }

  async function confirm() {
    if (acting) return;
    setRefusal(null);
    setActing(true);
    try {
      await onConfirm(ticked);
    } catch (error) {
      setRefusal(problemDetail(error, actRefused(act)));
      setActing(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${label}?`}</AlertDialogTitle>
          <AlertDialogDescription>{actConsequence(act)}</AlertDialogDescription>
        </AlertDialogHeader>

        {refusal ? (
          <Alert variant="destructive">
            <AlertTitle>Nothing moved</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={act === 'end' ? 'destructive' : 'default'}
            disabled={acting}
            onClick={() => void confirm()}
          >
            {acting ? 'Moving…' : label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
