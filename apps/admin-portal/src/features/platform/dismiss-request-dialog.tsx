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
import type { AccessRequest } from './access-request';
import { useDismissAccessRequest } from './access-request-queries';

interface DismissRequestDialogProps {
  request: AccessRequest | null;
  onClose: () => void;
}

export function DismissRequestDialog({ request, onClose }: DismissRequestDialogProps) {
  const dismiss = useDismissAccessRequest();

  function changeOpen(open: boolean) {
    if (open || dismiss.isPending) return;
    dismiss.reset();
    onClose();
  }

  if (!request) return null;

  const selectedRequest = request;

  async function confirm() {
    try {
      await dismiss.mutateAsync({ params: { path: { request_id: selectedRequest.id } } });
      onClose();
    } catch {
      return;
    }
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Dismiss the request from ${selectedRequest.company}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {`It leaves the queue and no tenant is opened. Nothing is emailed to ${selectedRequest.email}, and they can ask again.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {dismiss.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Request not dismissed</AlertTitle>
            <AlertDescription>
              {problemMessage(dismiss.error, "This request couldn't be dismissed. Try again.")}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={dismiss.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={dismiss.isPending} onClick={confirm}>
            {dismiss.isPending ? 'Dismissing request…' : 'Dismiss request'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
