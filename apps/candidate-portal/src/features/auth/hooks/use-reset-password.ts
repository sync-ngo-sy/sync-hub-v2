import { toast } from 'sonner';
import { api } from '../../../lib/api-client';
import type { ResetPasswordValues } from '../schemas/password-reset-schema';
import { useLogin } from './use-login';

export function useResetPassword() {
  const { login } = useLogin();
  const mutation = api.useMutation('post', '/v1/auth/password-reset/confirm');

  // Setting the password ends every session, so we log the user straight back in with the
  // credentials they just chose — the reset leg lands them signed in on their home.
  async function resetPassword(values: ResetPasswordValues, tokenHash: string) {
    await mutation.mutateAsync({ body: { token_hash: tokenHash, password: values.password } });
    toast.success('Your password has been updated.');
    await login({ email: values.email, password: values.password });
  }

  return { resetPassword, mutation };
}
