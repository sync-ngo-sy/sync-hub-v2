import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { NO_SESSION } from '@/testing/fixtures';

type Profile = components['schemas']['ProfileView'];
type ConfirmEmailRequest = components['schemas']['ConfirmEmailRequest'];
type AcceptInviteRequest = components['schemas']['AcceptInviteRequest'];
type PasswordResetRequest = components['schemas']['PasswordResetRequest'];
type ConfirmPasswordResetRequest = components['schemas']['ConfirmPasswordResetRequest'];

export function signedInAs(profile: Profile) {
  return [http.get('/v1/auth/me', ({ response }) => response(200).json(profile))];
}

/**
 * A dead session also has to answer the refresh the client attempts before giving up,
 * or MSW sees an unhandled request instead of the expiry path.
 */
export function signedOut() {
  return [
    http.get('/v1/auth/me', ({ response }) => response(401).json(NO_SESSION)),
    http.post('/v1/auth/refresh', ({ response }) => response(401).json(NO_SESSION)),
  ];
}

export function logsIn(profile: Profile) {
  return [http.post('/v1/auth/login', ({ response }) => response(200).json(profile))];
}

export function rejectsCredentials(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/login', ({ response }) => response(401).json(problem))];
}

export function logsOut() {
  return [http.post('/v1/auth/logout', ({ response }) => response(204).empty())];
}

export function confirmsEmail(profile: Profile, onRequest?: (body: ConfirmEmailRequest) => void) {
  return [
    http.post('/v1/auth/confirm-email', async ({ request, response }) => {
      onRequest?.((await request.json()) as ConfirmEmailRequest);
      return response(200).json(profile);
    }),
  ];
}

export function refusesConfirmation(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/confirm-email', ({ response }) => response(400).json(problem))];
}

export function faultsOnConfirmation(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/confirm-email', ({ response }) => response(500).json(problem))];
}

export function acceptsInvite(profile: Profile, onRequest?: (body: AcceptInviteRequest) => void) {
  return [
    http.post('/v1/auth/accept-invite', async ({ request, response }) => {
      onRequest?.((await request.json()) as AcceptInviteRequest);
      return response(200).json(profile);
    }),
  ];
}

export function refusesInvite(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/accept-invite', ({ response }) => response(400).json(problem))];
}

export function faultsOnInvite(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/accept-invite', ({ response }) => response(500).json(problem))];
}

export function sendsResetEmail(onRequest?: (body: PasswordResetRequest) => void) {
  return [
    http.post('/v1/auth/password-reset', async ({ request, response }) => {
      onRequest?.((await request.json()) as PasswordResetRequest);
      return response(202).empty();
    }),
  ];
}

export function faultsOnResetRequest(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/password-reset', ({ response }) => response(500).json(problem))];
}

export function resetsPassword(onRequest?: (body: ConfirmPasswordResetRequest) => void) {
  return [
    http.post('/v1/auth/password-reset/confirm', async ({ request, response }) => {
      onRequest?.((await request.json()) as ConfirmPasswordResetRequest);
      return response(204).empty();
    }),
  ];
}

export function refusesReset(problem: components['schemas']['ProblemDetail']) {
  return [
    http.post('/v1/auth/password-reset/confirm', ({ response }) => response(400).json(problem)),
  ];
}

export function faultsOnReset(problem: components['schemas']['ProblemDetail']) {
  return [
    http.post('/v1/auth/password-reset/confirm', ({ response }) => response(500).json(problem)),
  ];
}
