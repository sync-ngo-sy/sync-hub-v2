import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

type AskForAccessRequest = components['schemas']['AskForAccessRequest'];

export function acceptsAccessRequest(onRequest?: (body: AskForAccessRequest) => void) {
  return [
    http.post('/v1/access-requests', async ({ request, response }) => {
      onRequest?.((await request.json()) as AskForAccessRequest);
      return response(202).empty();
    }),
  ];
}

export function refusesAccessRequest(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/access-requests', ({ response }) => response(429).json(problem))];
}
