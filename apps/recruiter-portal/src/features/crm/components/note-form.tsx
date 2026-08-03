import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { problemDetail } from '@/lib/api-problem';
import { type NoteTextValues, noteTextSchema } from '../schemas/note-text';

interface NoteFormProps {
  label: string;
  defaultText?: string;
  placeholder?: string;
  submitLabel: string;
  pendingLabel: string;
  refusalTitle: string;
  refusalFallback: string;
  autoFocus?: boolean;
  onSubmit: (text: string) => Promise<unknown>;
  onCancel?: () => void;
}

export function NoteForm({
  label,
  defaultText = '',
  placeholder,
  submitLabel,
  pendingLabel,
  refusalTitle,
  refusalFallback,
  autoFocus,
  onSubmit,
  onCancel,
}: NoteFormProps) {
  const form = useForm<NoteTextValues>({
    resolver: zodResolver(noteTextSchema),
    defaultValues: { text: defaultText },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.text.trim());
      form.reset({ text: '' });
    } catch (error) {
      form.setError('root', { message: problemDetail(error, refusalFallback) });
    }
  });

  const pending = form.formState.isSubmitting;

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormField control={form.control} name="text" label={label}>
        {(field) => (
          <Textarea
            {...field}
            value={field.value}
            rows={3}
            autoFocus={autoFocus}
            placeholder={placeholder}
          />
        )}
      </FormField>

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{refusalTitle}</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
