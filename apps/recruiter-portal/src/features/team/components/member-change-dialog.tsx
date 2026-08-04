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
import { toast } from 'sonner';
import { problemDetail } from '@/lib/api-problem';
import { useChangeMember } from '../hooks/use-member-actions';
import type { Member, MemberChange } from '../member';

interface MemberChangeDialogProps {
  member: Member;
  change: MemberChange;
  onClose: () => void;
}

export function MemberChangeDialog({ member, change, onClose }: MemberChangeDialogProps) {
  const apply = useChangeMember();

  function changeOpen(open: boolean) {
    if (open || apply.isPending) return;
    apply.reset();
    onClose();
  }

  async function confirm() {
    try {
      await apply.mutateAsync({
        params: { path: { recruiter_id: member.id } },
        body: change.body,
      });
    } catch {
      return;
    }
    toast.success(change.success);
    onClose();
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{change.title}</AlertDialogTitle>
          <AlertDialogDescription>{change.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {apply.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{`${member.full_name} is as they were`}</AlertTitle>
            <AlertDescription>
              {problemDetail(apply.error, 'That change was refused. Try again.')}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={apply.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={change.destructive ? 'destructive' : 'default'}
            disabled={apply.isPending}
            onClick={confirm}
          >
            {apply.isPending ? change.pendingLabel : change.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
