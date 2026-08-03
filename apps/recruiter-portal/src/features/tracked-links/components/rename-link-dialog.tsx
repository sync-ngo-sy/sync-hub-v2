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
import { problemMessage } from '@/lib/api-problem';
import { useChangeTrackedLink } from '../hooks/use-tracked-link-actions';
import { type LinkNameValues, linkNameSchema } from '../schemas/link-name';
import type { TrackedLink } from '../tracked-link';

interface RenameLinkDialogProps {
  jobId: string;
  link: TrackedLink;
  onClose: () => void;
}

export function RenameLinkDialog({ jobId, link, onClose }: RenameLinkDialogProps) {
  const rename = useChangeTrackedLink(jobId);
  const form = useForm<LinkNameValues>({
    resolver: zodResolver(linkNameSchema),
    defaultValues: { name: link.name },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await rename.mutateAsync({
        params: { path: { job_id: jobId, link_id: link.id } },
        body: { name: values.name.trim() },
      });
      toast.success('Tracked link renamed');
      onClose();
    } catch (error) {
      form.setError('root', { message: problemMessage(error, "This link couldn't be renamed.") });
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Rename tracked link</DialogTitle>
            <DialogDescription>
              The address stays what it was, and so do the views it has already brought.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <FormField control={form.control} name="name" label="Name">
              {(field) => <Input {...field} value={field.value} autoFocus />}
            </FormField>
          </div>

          {form.formState.errors.root?.message ? (
            <Alert className="mb-4">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Name not changed</AlertTitle>
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={rename.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
