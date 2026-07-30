import { CANDIDATE, problem, RECRUITER, TENANT } from '@/testing/fixtures';
import { http } from '@/testing/server';

const unauthorized = () => problem(401, 'Unauthorized');

/** The client answers every 401 with a refresh, so any set that can 401 must answer that too. */
const refreshFails = () =>
  http.post('/v1/auth/refresh', ({ response }) => response(401).json(unauthorized()));

export const signedInAsRecruiter = () => [
  http.get('/v1/auth/me', ({ response }) => response(200).json(RECRUITER)),
  http.get('/v1/tenants/me', ({ response }) => response(200).json(TENANT)),
];

export const signedInAsCandidate = () => [
  http.get('/v1/auth/me', ({ response }) => response(200).json(CANDIDATE)),
];

export const signedOut = () => [
  http.get('/v1/auth/me', ({ response }) => response(401).json(unauthorized())),
  refreshFails(),
];

export const logsOut = () => http.post('/v1/auth/logout', ({ response }) => response(204).empty());

export const signsIn = (password = 'correct-horse-battery') => {
  let session = false;
  return [
    http.get('/v1/auth/me', ({ response }) =>
      session ? response(200).json(RECRUITER) : response(401).json(unauthorized()),
    ),
    http.get('/v1/tenants/me', ({ response }) => response(200).json(TENANT)),
    http.post('/v1/auth/login', async ({ request, response }) => {
      const body = await request.json();
      if (body.password !== password) return response(401).json(unauthorized());
      session = true;
      return response(200).json(RECRUITER);
    }),
    refreshFails(),
  ];
};
