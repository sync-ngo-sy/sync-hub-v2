import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../../../lib/api-client';
import { establishSession, homePathFor } from '../../../lib/auth';
import type { LoginValues } from '../schemas/login-schema';

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = api.useMutation('post', '/v1/auth/login');

  async function login(values: LoginValues, returnTo?: string) {
    const profile = await mutation.mutateAsync({ body: values });
    establishSession(queryClient, profile);
    const home = homePathFor(profile);
    await navigate({ href: home === '/applications' ? (returnTo ?? home) : home });
  }

  return { login, mutation };
}
