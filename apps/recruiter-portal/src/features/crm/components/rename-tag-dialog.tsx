import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemDetail } from '@/lib/api-problem';
import { useRenameTag } from '../hooks/use-tag-vocabulary';
import { TAG_NAME_TAKEN_PROBLEM } from '../problems';
import { type TagFormValues, tagNameSchema } from '../schemas/tag';
import { SCOPE_LABELS, type Tag } from '../tag';

interface RenameTagDialogProps {
  vocabulary: Tag[];
  tag: Tag;
  onClose: () => void;
}

export function RenameTagDialog({ vocabulary, tag, onClose }: RenameTagDialogProps) {
  const rename = useRenameTag();
  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagNameSchema(vocabulary, tag)),
    defaultValues: { name: tag.name, scope: tag.scope },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      await rename.mutateAsync({
        params: { path: { tag_id: tag.id } },
        body: { name: values.name.trim() },
      });
      toast.success('Tag renamed');
      onClose();
    } catch (error) {
      // A word a colleague minted in the meantime is about the name, so it lands under it; any
      // other refusal is about the rename, and belongs to the form.
      const field = isProblem(error, TAG_NAME_TAKEN_PROBLEM) ? 'name' : 'root';
      form.setError(field, {
        message: problemDetail(error, "That Tag couldn't be renamed. Try again."),
      });
    }
  });

  return (
    <Dialog open onOpenChange={(open) => (open || rename.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} noValidate>
          <DialogHeader>
            <DialogTitle>{`Rename “${tag.name}”`}</DialogTitle>
            <DialogDescription>
              {`Everything already filed under it stays filed, and it goes on ${SCOPE_LABELS[
                tag.scope
              ].toLocaleLowerCase()} as before.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <FormField control={form.control} name="name" label="Name">
              {(field) => <Input {...field} value={field.value} autoComplete="off" autoFocus />}
            </FormField>
          </div>

          {form.formState.errors.root?.message ? (
            <Alert className="mb-4">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Tag not renamed</AlertTitle>
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={rename.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending ? 'Saving name…' : 'Save name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
