import { useNavigate } from '@tanstack/react-router';
import { api } from '../../../lib/api-client';
import type { SignUpValues } from '../schemas/signup-schema';

export function useSignUp() {
  const navigate = useNavigate();
  const mutation = api.useMutation('post', '/v1/auth/signup');

  // Sign-up creates the account but issues no session (the email link does). Success lands on the
  // check-your-email screen, carrying the address so it can name where the link was sent.
  async function signUp(values: SignUpValues) {
    await mutation.mutateAsync({ body: values });
    await navigate({ to: '/check-email', search: { email: values.email } });
  }

  return { signUp, mutation };
}
