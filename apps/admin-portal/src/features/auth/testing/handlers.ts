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
