import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { problemMessage } from '@/lib/api-problem';
import { type LinkNameValues, linkNameSchema } from '../schemas/link-name';

interface LinkNameFormProps {
  title: string;
  description: string;
  defaultName: string;
  fieldDescription?: string;
  placeholder?: string;
  submitLabel: string;
  pendingLabel: string;
  refusalTitle: string;
  refusalFallback: string;
  onSubmit: (name: string) => Promise<unknown>;
  onCancel: () => void;
}

export function LinkNameForm({
  title,
  description,
  defaultName,
  fieldDescription,
  placeholder,
  submitLabel,
  pendingLabel,
  refusalTitle,
  refusalFallback,
  onSubmit,
  onCancel,
}: LinkNameFormProps) {
  const form = useForm<LinkNameValues>({
    resolver: zodResolver(linkNameSchema),
    defaultValues: { name: defaultName },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.name.trim());
    } catch (error) {
      form.setError('root', { message: problemMessage(error, refusalFallback) });
    }
  });

  const pending = form.formState.isSubmitting;

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <FormField control={form.control} name="name" label="Name" description={fieldDescription}>
          {(field) => <Input {...field} value={field.value} autoFocus placeholder={placeholder} />}
        </FormField>
      </div>

      {form.formState.errors.root?.message ? (
        <Alert className="mb-4">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{refusalTitle}</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
