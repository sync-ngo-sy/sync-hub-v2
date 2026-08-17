import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { PasswordInput } from '@sync/ui/components/password-input';
import { Button } from '@sync/ui/components/ui/button';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemMessage } from '@/lib/api-problem';
import { useChangePassword } from '../hooks/use-change-password';
import { PASSWORD_POLICY_SUMMARY } from '../password-rules';
import {
  INVALID_CREDENTIALS_PROBLEM,
  PASSWORD_UNCHANGED_PROBLEM,
  WEAK_PASSWORD_PROBLEM,
} from '../problems';
import { type ChangePasswordValues, changePasswordSchema } from '../schemas/change-password';

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '' },
  });

  const submit = handleSubmit(async (body) => {
    try {
      await changePassword.mutateAsync({ body });
      reset();
      toast.success("Password changed. You're signed out everywhere else.");
    } catch (error) {
      const message = problemMessage(error, "Couldn't change your password. Try again.");
      if (isProblem(error, INVALID_CREDENTIALS_PROBLEM)) {
        setError('current_password', { message });
        return;
      }
      if (isProblem(error, WEAK_PASSWORD_PROBLEM) || isProblem(error, PASSWORD_UNCHANGED_PROBLEM)) {
        setError('new_password', { message });
        return;
      }
      toast.error(message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField control={control} name="current_password" label="Current password">
        {(field) => <PasswordInput {...field} autoComplete="current-password" />}
      </FormField>

      <FormField
        control={control}
        name="new_password"
        label="New password"
        description={PASSWORD_POLICY_SUMMARY}
      >
        {(field) => <PasswordInput {...field} autoComplete="new-password" />}
      </FormField>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Changing password…' : 'Change password'}
      </Button>
    </form>
  );
}
