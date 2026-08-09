import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordForm } from '@sync/ui/components/auth-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { isProblem, problemMessage } from '@/lib/api-problem';
import { useAcceptInvite } from '../hooks/use-accept-invite';
import { PASSWORD_POLICY_SUMMARY } from '../password-rules';
import { DEAD_LINK_PROBLEM, WEAK_PASSWORD_PROBLEM } from '../problems';
import { type NewPasswordValues, newPasswordSchema } from '../schemas/new-password';

interface AcceptInviteFormProps {
  tokenHash: string;
  onAccepted: () => void;
  onDeadLink: () => void;
}

export function AcceptInviteForm({ tokenHash, onAccepted, onDeadLink }: AcceptInviteFormProps) {
  const acceptInvite = useAcceptInvite();
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
      await acceptInvite.mutateAsync({ body: { token_hash: tokenHash, password } });
      onAccepted();
    } catch (error) {
      if (isProblem(error, DEAD_LINK_PROBLEM)) {
        onDeadLink();
        return;
      }
      const message = problemMessage(error, "Couldn't accept your invitation. Try again.");
      if (isProblem(error, WEAK_PASSWORD_PROBLEM)) {
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
      label="Choose a password"
      description={PASSWORD_POLICY_SUMMARY}
      pendingLabel="Joining workspace…"
      submitLabel="Join workspace"
    />
  );
}
