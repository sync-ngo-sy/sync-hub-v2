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
import { problemMessage } from '@/lib/api-problem';
import type { Application } from '../application';
import { useWithdrawApplication } from '../hooks/use-application-actions';

interface WithdrawApplicationDialogProps {
  application: Application;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawApplicationDialog({
  application,
  open,
  onOpenChange,
}: WithdrawApplicationDialogProps) {
  const withdraw = useWithdrawApplication();

  function changeOpen(nextOpen: boolean) {
    if (withdraw.isPending) return;
    withdraw.reset();
    onOpenChange(nextOpen);
  }

  async function confirm() {
    try {
      await withdraw.mutateAsync({ params: { path: { application_id: application.id } } });
      onOpenChange(false);
    } catch {
      return;
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-medium text-foreground">{application.job.title}</span>
            <span className="mt-2 block">
              This cannot be undone. You cannot apply to this job again after withdrawing.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {withdraw.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Application not withdrawn</AlertTitle>
            <AlertDescription>
              {problemMessage(withdraw.error, "This application couldn't be withdrawn.")}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={withdraw.isPending}>Keep application</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={withdraw.isPending} onClick={confirm}>
            {withdraw.isPending ? 'Withdrawing…' : 'Withdraw for good'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
