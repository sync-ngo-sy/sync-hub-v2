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
import { problemMessage } from '@/lib/api-problem';
import { useTalentPoolActions } from '../hooks/use-talent-pool';
import type { PooledCandidate } from '../pool';

const LOSES =
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
      setFailure(
        problemMessage(error, "That Candidate couldn't be dropped. Your talent pool is as it was."),
      );
      return;
    }
    toast.success(`${entry.full_name} dropped from your talent pool`);
    onClose();
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Drop ${entry.full_name} from your talent pool?`}</AlertDialogTitle>
          <AlertDialogDescription>{LOSES}</AlertDialogDescription>
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
