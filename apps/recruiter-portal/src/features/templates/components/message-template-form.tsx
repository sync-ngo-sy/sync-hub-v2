import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useCreateMessageTemplate,
  useReviseMessageTemplate,
} from '../hooks/use-message-template-actions';
import type {
  MessageTemplate,
  MessageTemplateChanges,
  NewMessageTemplate,
} from '../message-template';
import { asList, FILLABLE } from '../placeholders';
import { messageTemplateRejection } from '../rejection';
import {
  type MessageTemplateFormValues,
  messageTemplateFormSchema,
} from '../schemas/message-template';

const EMPTY_TEMPLATE: MessageTemplateFormValues = { name: '', subject: '', body: '' };

const MAY_USE = `May use ${asList(FILLABLE)}.`;

function written(values: MessageTemplateFormValues): NewMessageTemplate {
  return {
    name: values.name.trim(),
    subject: values.subject.trim(),
    body: values.body.trim(),
  };
}

function editValues(template: MessageTemplate): MessageTemplateFormValues {
  return { name: template.name, subject: template.subject, body: template.body };
}

interface MessageTemplateFormProps {
  template?: MessageTemplate;
  onSaved: () => void;
  onCancel: () => void;
}

export function MessageTemplateForm({ template, onSaved, onCancel }: MessageTemplateFormProps) {
  const create = useCreateMessageTemplate();
  const revise = useReviseMessageTemplate();
  const form = useForm<MessageTemplateFormValues>({
    resolver: zodResolver(messageTemplateFormSchema),
    defaultValues: template ? editValues(template) : EMPTY_TEMPLATE,
  });

  const save = form.handleSubmit(async (values) => {
    try {
      if (template) {
        await revise.mutateAsync({
          params: { path: { template_id: template.id } },
          body: written(values) satisfies MessageTemplateChanges,
        });
        toast.success('Template updated');
      } else {
        await create.mutateAsync({ body: written(values) });
        toast.success('Template saved');
      }
      onSaved();
    } catch (error) {
      const rejection = messageTemplateRejection(error);
      for (const field of rejection.fields) form.setError(field.name, { message: field.message });
      if (rejection.root) form.setError('root', { message: rejection.root });
    }
  });
  const isPending = create.isPending || revise.isPending;

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        label="Name"
        description="What your team will pick it by."
      >
        {(field) => <Input {...field} value={field.value} autoFocus />}
      </FormField>

      <FormField control={form.control} name="subject" label="Subject" description={MAY_USE}>
        {(field) => <Input {...field} value={field.value} />}
      </FormField>

      <FormField
        control={form.control}
        name="body"
        label="Message"
        description={`${MAY_USE} A blank line parts paragraphs.`}
      >
        {(field) => <Textarea {...field} value={field.value} rows={10} />}
      </FormField>

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Template not saved</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : template ? 'Save changes' : 'Save template'}
        </Button>
      </div>
    </form>
  );
}
