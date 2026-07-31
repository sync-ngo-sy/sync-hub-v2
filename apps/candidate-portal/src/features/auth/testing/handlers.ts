import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { NO_SESSION } from '@/testing/fixtures';

type Profile = components['schemas']['ProfileView'];

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

export function faultsOnSignIn(problem: components['schemas']['ProblemDetail']) {
  return [http.post('/v1/auth/login', ({ response }) => response(500).json(problem))];
}

export function logsOut() {
  return [http.post('/v1/auth/logout', ({ response }) => response(204).empty())];
}
