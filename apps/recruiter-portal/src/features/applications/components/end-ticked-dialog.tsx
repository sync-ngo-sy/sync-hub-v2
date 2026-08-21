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
import { endLabel, type SweptApplications } from '../ending';

const WHAT_ENDING_COSTS =
  'They are rejected, and they hear three days from now. Until then nothing has reached them, ' +
  'and moving one back to Reviewing inside those three days cancels it.';

const REFUSED =
  "Some of these Applications couldn't be ended. The list has been read again, so it says which.";

interface EndTickedDialogProps {
  ticked: string[];
  onConfirm: (ticked: string[]) => Promise<SweptApplications>;
  onClose: () => void;
}

export function EndTickedDialog({ ticked, onConfirm, onClose }: EndTickedDialogProps) {
  const [ending, setEnding] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  function changeOpen(open: boolean) {
    if (open || ending) return;
    onClose();
  }

  async function confirm() {
    if (ending) return;
    setRefusal(null);
    setEnding(true);
    try {
      await onConfirm(ticked);
    } catch (error) {
      setRefusal(problemDetail(error, REFUSED));
      setEnding(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`${endLabel(ticked.length)}?`}</AlertDialogTitle>
          <AlertDialogDescription>{WHAT_ENDING_COSTS}</AlertDialogDescription>
        </AlertDialogHeader>

        {refusal ? (
          <Alert variant="destructive">
            <AlertTitle>Not all ended</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={ending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={ending} onClick={() => void confirm()}>
            {ending ? 'Ending…' : endLabel(ticked.length)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
