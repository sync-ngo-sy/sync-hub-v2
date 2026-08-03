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
import { problemMessage } from '@/lib/api-problem';
import { useDeleteMessageTemplate } from '../hooks/use-message-template-actions';
import type { MessageTemplate } from '../message-template';

interface DeleteTemplateDialogProps {
  template: MessageTemplate | null;
  onClose: () => void;
}

export function DeleteTemplateDialog({ template, onClose }: DeleteTemplateDialogProps) {
  const remove = useDeleteMessageTemplate();

  function changeOpen(open: boolean) {
    if (open || remove.isPending) return;
    remove.reset();
    onClose();
  }

  if (!template) return null;

  const doomed = template;

  async function confirm() {
    try {
      await remove.mutateAsync({ params: { path: { template_id: doomed.id } } });
      toast.success('Template deleted');
      onClose();
    } catch {
      return;
    }
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete “${doomed.name}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            Your team loses these words. Messages already sent from it are untouched — each one
            carries the words it was sent with.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {remove.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Template not deleted</AlertTitle>
            <AlertDescription>
              {problemMessage(remove.error, "This template couldn't be deleted. Try again.")}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {remove.isPending ? 'Deleting template…' : 'Delete template'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
