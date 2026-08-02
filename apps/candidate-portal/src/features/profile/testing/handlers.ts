import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

type CandidateProfile = components['schemas']['CandidateProfile'];
type ProblemDetail = components['schemas']['ProblemDetail'];
type ValidationProblemDetail = components['schemas']['ValidationProblemDetail'];

export function hasProfile(profile: CandidateProfile) {
  return [http.get('/v1/candidates/me/profile', ({ response }) => response(200).json(profile))];
}

export function failsToLoadProfile(problem: ProblemDetail) {
  return [http.get('/v1/candidates/me/profile', ({ response }) => response(500).json(problem))];
}

/** `onSave` is how a test reads the whole-profile body the form put back. */
export function savesProfile(saved: CandidateProfile, onSave?: (body: CandidateProfile) => void) {
  return [
    http.put('/v1/candidates/me/profile', async ({ request, response }) => {
      onSave?.(await request.json());
      return response(200).json(saved);
    }),
  ];
}

/** Answers with the body it was sent, as a whole-profile replace does. */
export function echoesProfile(onSave?: (body: CandidateProfile) => void) {
  return [
    http.put('/v1/candidates/me/profile', async ({ request, response }) => {
      const body = await request.json();
      onSave?.(body);
      return response(200).json(body);
    }),
  ];
}

export function refusesProfile(problem: ValidationProblemDetail) {
  return [http.put('/v1/candidates/me/profile', ({ response }) => response(422).json(problem))];
}

export function refusesSearchable(problem: ProblemDetail) {
  return [http.put('/v1/candidates/me/profile', ({ response }) => response(409).json(problem))];
}

export function faultsOnSave(problem: ProblemDetail) {
  return [http.put('/v1/candidates/me/profile', ({ response }) => response(500).json(problem))];
}
