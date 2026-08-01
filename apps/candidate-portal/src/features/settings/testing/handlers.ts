import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { delay } from 'msw';

type DeleteAccountRequest = components['schemas']['DeleteAccountRequest'];
type ProblemDetail = components['schemas']['ProblemDetail'];

export function deletesAccount(onDelete?: (body: DeleteAccountRequest) => void) {
  return [
    http.post('/v1/candidates/me/deletion', async ({ request, response }) => {
      onDelete?.((await request.json()) as DeleteAccountRequest);
      return response(204).empty();
    }),
  ];
}

export function refusesAccountDeletion(problem: ProblemDetail) {
  return [http.post('/v1/candidates/me/deletion', ({ response }) => response(401).json(problem))];
}

export function withholdsAccountDeletion() {
  return [
    http.post('/v1/candidates/me/deletion', async ({ response }) => {
      await delay('infinite');
      return response(204).empty();
    }),
  ];
}
