import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { useRequestAccess } from '../hooks/use-request-access';
import { type AccessRequestValues, accessRequestSchema } from '../schemas/access-request';

const empty: AccessRequestValues = { company: '', full_name: '', email: '' };

export function RequestAccessForm({ onRequested }: { onRequested: () => void }) {
  const requestAccess = useRequestAccess();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AccessRequestValues>({
    resolver: zodResolver(accessRequestSchema),
    defaultValues: empty,
  });

  const submit = handleSubmit(async (values) => {
    try {
      await requestAccess.mutateAsync({ body: values });
      onRequested();
    } catch (error) {
      toast.error(problemMessage(error, "Couldn't send your request. Try again."));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField control={control} name="company" label="Company">
        {(field) => <Input {...field} autoComplete="organization" />}
      </FormField>

      <FormField control={control} name="full_name" label="Your name">
        {(field) => <Input {...field} autoComplete="name" />}
      </FormField>

      <FormField control={control} name="email" label="Work email">
        {(field) => <Input {...field} type="email" autoComplete="email" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Sending your request…' : 'Request access'}
      </Button>
    </form>
  );
}
