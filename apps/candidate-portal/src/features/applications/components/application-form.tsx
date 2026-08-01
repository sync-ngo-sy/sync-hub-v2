import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Label } from '@sync/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@sync/ui/components/ui/radio-group';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { NewApplication, PublicJobQuestion } from '../application';
import { useSubmitApplication } from '../hooks/use-application-actions';
import { applicationRejection } from '../rejection';
import { type ApplicationFormValues, applicationFormSchema } from '../schemas/application';

interface ApplicationFormProps {
  jobId: string;
  questions: PublicJobQuestion[];
  onApplied: () => void;
  onCancel: () => void;
}

export function ApplicationForm({ jobId, questions, onApplied, onCancel }: ApplicationFormProps) {
  const submit = useSubmitApplication();
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema(questions)),
    defaultValues: {
      answers: Object.fromEntries(questions.map((question) => [question.id, ''])),
    },
  });

  const send = form.handleSubmit(async (values) => {
    const answers: NonNullable<NewApplication['answers']> = [];
    for (const question of questions) {
      const value = values.answers[question.id]?.trim();
      if (!value) continue;
      answers.push(
        question.question_type === 'yes_no'
          ? { question_id: question.id, answer_boolean: value === 'yes' }
          : { question_id: question.id, answer_text: value },
      );
    }

    const body: NewApplication = {
      job_id: jobId,
      answers,
    };

    try {
      await submit.mutateAsync({ body });
      onApplied();
    } catch (error) {
      const rejection = applicationRejection(error, answers);
      for (const field of rejection.fields) form.setError(field.name, { message: field.message });
      if (rejection.root) form.setError('root', { message: rejection.root });
    }
  });

  return (
    <form onSubmit={send} noValidate className="max-w-xl space-y-5 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 className="font-heading text-h3 text-foreground">Your application</h2>
        <p className="text-dense text-muted-foreground">
          Your current CV and saved profile will be sent with these answers.
        </p>
      </div>

      {questions.map((question) => (
        <FormField
          key={question.id}
          control={form.control}
          name={`answers.${question.id}`}
          label={question.question_text}
          description={question.is_required ? 'Required' : 'Optional'}
        >
          {({ value, onChange, onBlur, name, ref, ...field }) =>
            question.question_type === 'yes_no' ? (
              <RadioGroup
                {...field}
                ref={ref}
                name={name}
                value={value ?? ''}
                onValueChange={onChange}
                onBlur={onBlur}
                aria-label={question.question_text}
                className="flex gap-5"
              >
                <RadioChoice id={`${field.id}-yes`} value="yes" label="Yes" />
                <RadioChoice id={`${field.id}-no`} value="no" label="No" />
              </RadioGroup>
            ) : (
              <Textarea
                {...field}
                ref={ref}
                name={name}
                value={value ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                rows={3}
              />
            )
          }
        </FormField>
      ))}

      {form.formState.errors.root?.message ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Application not sent</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Submit application'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={submit.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RadioChoice({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
