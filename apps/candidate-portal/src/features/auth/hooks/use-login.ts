import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api, profileQueryOptions } from '../../../lib/api-client';
import { homePathFor } from '../../../lib/auth';
import { setAuthenticated } from '../../../lib/session';
import type { LoginValues } from '../schemas/login-schema';

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = api.useMutation('post', '/v1/auth/login');

  async function login(values: LoginValues, returnTo?: string) {
    const profile = await mutation.mutateAsync({ body: values });
    setAuthenticated(true);
    queryClient.setQueryData(profileQueryOptions.queryKey, profile);
    const home = homePathFor(profile);
    await navigate({ href: home === '/applications' ? (returnTo ?? home) : home });
  }

  return { login, mutation };
}
