import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { useRequestPasswordReset } from '../hooks/use-request-password-reset';
import {
  type PasswordResetRequestValues,
  passwordResetRequestSchema,
} from '../schemas/password-reset-request';

export function ForgotPasswordForm({ onSent }: { onSent: (email: string) => void }) {
  const requestReset = useRequestPasswordReset();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await requestReset.mutateAsync({ body: values });
      onSent(values.email);
    } catch (error) {
      // Nothing here is the field's fault: the API accepts any address it can parse, and Zod
      // has already parsed this one. What is left — rate limiting, a fault — is homeless.
      toast.error(problemMessage(error, "Couldn't send the email. Try again."));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField control={control} name="email" label="Email">
        {(field) => <Input {...field} type="email" autoComplete="email" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
