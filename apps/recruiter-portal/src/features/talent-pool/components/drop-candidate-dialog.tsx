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
import { toast } from 'sonner';
import { problemDetail } from '@/lib/api-problem';
import { useTalentPoolActions } from '../hooks/use-talent-pool';
import { DROP_REFUSED, droppedSays, type PooledCandidate } from '../pool';

const WHAT_DROPPING_COSTS =
  'They leave this list. Your notes and Tags on them stay, but nothing points at them here until a search finds them again.';

interface DropCandidateDialogProps {
  entry: PooledCandidate;
  onClose: () => void;
}

export function DropCandidateDialog({ entry, onClose }: DropCandidateDialogProps) {
  const actions = useTalentPoolActions();
  const [failure, setFailure] = useState<string | null>(null);

  function changeOpen(open: boolean) {
    if (open || actions.isChanging) return;
    onClose();
  }

  async function confirm() {
    if (actions.isChanging) return;
    setFailure(null);
    try {
      await actions.drop(entry.candidate_id);
    } catch (error) {
      setFailure(problemDetail(error, DROP_REFUSED));
      return;
    }
    toast.success(droppedSays(entry.full_name));
    onClose();
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Drop ${entry.full_name} from your talent pool?`}</AlertDialogTitle>
          <AlertDialogDescription>{WHAT_DROPPING_COSTS}</AlertDialogDescription>
        </AlertDialogHeader>

        {failure ? (
          <Alert variant="destructive">
            <AlertTitle>Talent pool unchanged</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={actions.isChanging}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={actions.isChanging}
            onClick={() => void confirm()}
          >
            {actions.isChanging ? 'Dropping…' : 'Drop from talent pool'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
