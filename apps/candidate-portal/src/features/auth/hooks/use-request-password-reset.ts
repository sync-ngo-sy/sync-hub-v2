import { api } from '../../../lib/api-client';
import type { RequestPasswordResetValues } from '../schemas/password-reset-schema';

export function useRequestPasswordReset() {
  const mutation = api.useMutation('post', '/v1/auth/password-reset');

  // The API accepts every address the same way, revealing nothing about who has an account; the
  // caller reports success neutrally off `mutation.isSuccess`.
  async function requestReset(values: RequestPasswordResetValues) {
    await mutation.mutateAsync({ body: values });
  }

  return { requestReset, mutation };
}
