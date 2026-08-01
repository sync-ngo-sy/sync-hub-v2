import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isClientError, isProblem, problemMessage } from '@/lib/api-problem';
import { useResetPassword } from '../hooks/use-reset-password';
import { type NewPasswordValues, newPasswordSchema } from '../schemas/new-password';

const DEAD_LINK = 'urn:sync:problem:invalid-email-token';

interface NewPasswordFormProps {
  tokenHash: string;
  onReset: () => void;
  onDeadLink: () => void;
}

export function NewPasswordForm({ tokenHash, onReset, onDeadLink }: NewPasswordFormProps) {
  const resetPassword = useResetPassword();
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '' },
  });

  const submit = handleSubmit(async ({ password }) => {
    try {
      await resetPassword.mutateAsync({ body: { token_hash: tokenHash, password } });
      onReset();
    } catch (error) {
      // Both arrive as a 400: a link nothing can fix belongs on its own screen, a refused
      // password belongs beside the field the reader can still edit.
      if (isProblem(error, DEAD_LINK)) {
        onDeadLink();
        return;
      }
      const message = problemMessage(error, "Couldn't set your password. Try again.");
      if (isClientError(error)) {
        setError('password', { message });
        return;
      }
      toast.error(message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField
        control={control}
        name="password"
        label="New password"
        description="At least 8 characters."
      >
        {(field) => <Input {...field} type="password" autoComplete="new-password" />}
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}
