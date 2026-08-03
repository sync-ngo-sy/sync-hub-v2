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
import { problemMessage, problemStatus } from '@/lib/api-problem';
import { useDeleteTag } from '../hooks/use-tag-vocabulary';
import type { Tag, TagScope } from '../tag';

/** Deleting unfiles, which is the part a Recruiter cannot see from the list. */
const UNFILES: Record<TagScope, string> = {
  application:
    'Every Application filed under it loses it. The Applications themselves are untouched.',
  candidate: 'Every Candidate filed under it loses it. The Candidates themselves are untouched.',
};

interface DeleteTagDialogProps {
  tag: Tag;
  onClose: () => void;
}

export function DeleteTagDialog({ tag, onClose }: DeleteTagDialogProps) {
  const remove = useDeleteTag();

  function changeOpen(open: boolean) {
    if (open || remove.isPending) return;
    remove.reset();
    onClose();
  }

  async function confirm() {
    try {
      await remove.mutateAsync({ params: { path: { tag_id: tag.id } } });
    } catch (error) {
      // A Tag a colleague has already deleted is deleted, which is what was asked for.
      if (problemStatus(error) !== 404) return;
    }
    toast.success('Tag deleted');
    onClose();
  }

  return (
    <AlertDialog open onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete “${tag.name}”?`}</AlertDialogTitle>
          <AlertDialogDescription>{UNFILES[tag.scope]}</AlertDialogDescription>
        </AlertDialogHeader>

        {remove.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Tag not deleted</AlertTitle>
            <AlertDescription>
              {problemMessage(remove.error, "This Tag couldn't be deleted. Try again.")}
            </AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {remove.isPending ? 'Deleting Tag…' : 'Delete Tag'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
