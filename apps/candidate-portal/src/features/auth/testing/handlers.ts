import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { NO_SESSION } from '@/testing/fixtures';

type Profile = components['schemas']['ProfileView'];

export function signedInAs(profile: Profile) {
  return [http.get('/v1/auth/me', ({ response }) => response(200).json(profile))];
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

export function signsUp(profile: Profile, onRequest?: () => void) {
  return [
    http.post('/v1/auth/signup', ({ response }) => {
      onRequest?.();
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
