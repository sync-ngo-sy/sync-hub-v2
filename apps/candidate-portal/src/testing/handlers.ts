import { http, PROBLEM } from '@sync/api-client/testing';
import { server } from './server';

/**
 * The public pages read no session, but the app shell still probes `/auth/me`, and the client
 * answers any 401 with a refresh — so a signed-out test has to satisfy both.
 */
export function anonymousShell() {
  server.use(
    http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
    http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
  );
}
