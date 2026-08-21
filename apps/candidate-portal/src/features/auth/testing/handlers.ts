import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { NO_SESSION } from '@/testing/fixtures';
import { holding } from '@/testing/holding';

type Profile = components['schemas']['ProfileView'];

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

export function rejectsCredentials(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/login', ({ response }) => response(401).json(problem))];
}

export function faultsOnSignIn(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/login', ({ response }) => response(500).json(problem))];
}

export function faultsOnSession(problem: components['schemas']['ProblemDetail']) {
  return [http.get('/v1/auth/me', ({ response }) => response(500).json(problem))];
}

export function signedInUntilLogOut(profile: Profile) {
  let session = true;
  return [
    http.get('/v1/auth/me', ({ response }) =>
      session ? response(200).json(profile) : response(401).json(NO_SESSION),
    ),
    http.post('/v1/auth/refresh', ({ response }) => response(401).json(NO_SESSION)),
    http.post('/v1/auth/logout', ({ response }) => {
      session = false;
      return response(204).empty();
    }),
  ];
}

type SignUpRequest = components['schemas']['SignUpRequest'];

export function signsUp(profile: Profile, onRequest?: (body: SignUpRequest) => void) {
  return [
    http.post('/v1/auth/signup', async ({ request, response }) => {
      onRequest?.((await request.json()) as SignUpRequest);
      return response(201).json(profile);
    }),
  ];
}

export function refusesEmail(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/signup', ({ response }) => response(409).json(problem))];
}

export function refusesPassword(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/signup', ({ response }) => response(400).json(problem))];
}

export function refusesSignUpShape(problem: components['schemas']['ValidationProblemDetail']) {
  return [http.post('/v1/auth/signup', ({ response }) => response(422).json(problem))];
}

export function faultsOnSignUp(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/signup', ({ response }) => response(500).json(problem))];
}

export function confirmsEmail(profile: Profile) {
  return [http.post('/v1/auth/confirm-email', ({ response }) => response(200).json(profile))];
}

export function refusesConfirmation(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/confirm-email', ({ response }) => response(400).json(problem))];
}

export function faultsOnConfirmation(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/confirm-email', ({ response }) => response(500).json(problem))];
}

export function refusesConfirmationShape(
  problem: components['schemas']['ValidationProblemDetail'],
) {
  return [http.post('/v1/auth/confirm-email', ({ response }) => response(422).json(problem))];
}

export function sendsResetEmail() {
  return [http.post('/v1/auth/password-reset', ({ response }) => response(202).empty())];
}

export function faultsOnResetRequest(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/password-reset', ({ response }) => response(500).json(problem))];
}

export function resetsPassword() {
  return [http.post('/v1/auth/password-reset/confirm', ({ response }) => response(204).empty())];
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

type ChangePasswordRequest = components['schemas']['ChangePasswordRequest'];

export function changesPassword(onRequest?: (body: ChangePasswordRequest) => void) {
  return [
    http.post('/v1/auth/password', async ({ request, response }) => {
      onRequest?.((await request.json()) as ChangePasswordRequest);
      return response(204).empty();
    }),
  ];
}

export function rejectsCurrentPassword(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/password', ({ response }) => response(401).json(problem))];
}

export function refusesNewPassword(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/password', ({ response }) => response(400).json(problem))];
}
