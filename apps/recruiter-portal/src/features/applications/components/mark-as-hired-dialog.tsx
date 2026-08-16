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
import { problemMessage } from '@/lib/api-problem';
import { type HireValues, hireSchema } from '../schemas/hire';

interface MarkAsHiredDialogProps {
  onConfirm: (startDate: string) => Promise<unknown>;
  onClose: () => void;
}

export function MarkAsHiredDialog({ onConfirm, onClose }: MarkAsHiredDialogProps) {
  const form = useForm<HireValues>({
    resolver: zodResolver(hireSchema),
    defaultValues: { startDate: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await onConfirm(values.startDate);
    } catch (error) {
      form.setError('root', {
        message: problemMessage(error, "This Application couldn't be marked as hired."),
      });
    }
  });

  const pending = form.formState.isSubmitting;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Mark as hired</DialogTitle>
            <DialogDescription>
              The candidate is asked to confirm the day. Only their answer records a placement.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <FormField control={form.control} name="startDate" label="Start date">
              {(field) => <Input {...field} value={field.value} type="date" autoFocus />}
            </FormField>
          </div>

          {form.formState.errors.root?.message ? (
            <Alert className="mb-4">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Not marked as hired</AlertTitle>
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Marking…' : 'Mark as hired'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
