import { zodResolver } from '@hookform/resolvers/zod';
import { EmailForm } from '@sync/ui/components/auth-form';
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
      toast.error(problemMessage(error, "Couldn't send the email. Try again."));
    }
  });

  return <EmailForm control={control} onSubmit={submit} isSubmitting={isSubmitting} />;
}
