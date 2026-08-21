import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { NO_SESSION } from '@/testing/fixtures';
import { holding } from '@/testing/holding';

type Profile = components['schemas']['ProfileView'];
type ConfirmPasswordResetRequest = components['schemas']['ConfirmPasswordResetRequest'];

export function signedInAs(profile: Profile) {
  return [http.get('/v1/auth/me', ({ response }) => response(200).json(profile))];
}

export function holdsSession(profile: Profile) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get('/v1/auth/me', async ({ response }) => {
        await gate.held;
        return response(200).json(profile);
      }),
    ],
  };
}

export function signedOut() {
  return [
    http.get('/v1/auth/me', ({ response }) => response(401).json(NO_SESSION)),
    http.post('/v1/auth/refresh', ({ response }) => response(401).json(NO_SESSION)),
  ];
}

export function logsIn(profile: Profile) {
  return [http.post('/v1/auth/login', ({ response }) => response(200).json(profile))];
}

export function resetsPassword(onRequest?: (body: ConfirmPasswordResetRequest) => void) {
  return [
    http.post('/v1/auth/password-reset/confirm', async ({ request, response }) => {
      onRequest?.((await request.json()) as ConfirmPasswordResetRequest);
      return response(204).empty();
    }),
  ];
}
