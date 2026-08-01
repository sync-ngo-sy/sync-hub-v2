import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordForm } from '@sync/ui/components/auth-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemMessage } from '@/lib/api-problem';
import { useResetPassword } from '../hooks/use-reset-password';
import { DEAD_LINK_PROBLEM, PASSWORD_UNCHANGED_PROBLEM, WEAK_PASSWORD_PROBLEM } from '../problems';
import { type NewPasswordValues, newPasswordSchema } from '../schemas/new-password';

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
      if (isProblem(error, DEAD_LINK_PROBLEM)) {
        onDeadLink();
        return;
      }
      const message = problemMessage(error, "Couldn't set your password. Try again.");
      if (isProblem(error, WEAK_PASSWORD_PROBLEM) || isProblem(error, PASSWORD_UNCHANGED_PROBLEM)) {
        setError('password', { message });
        return;
      }
      toast.error(message);
    }
  });

  return (
    <PasswordForm
      control={control}
      onSubmit={submit}
      isSubmitting={isSubmitting}
      label="New password"
      pendingLabel="Saving…"
      submitLabel="Save new password"
    />
  );
}
