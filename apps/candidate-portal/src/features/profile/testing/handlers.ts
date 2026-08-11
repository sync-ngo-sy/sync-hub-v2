import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

type CandidateProfile = components['schemas']['CandidateProfile'];
type ProfileExperience = components['schemas']['ProfileExperience'];
type ProblemDetail = components['schemas']['ProblemDetail'];
type ValidationProblemDetail = components['schemas']['ValidationProblemDetail'];

export function hasProfile(profile: CandidateProfile) {
  return [http.get('/v1/candidates/me/profile', ({ response }) => response(200).json(profile))];
}

export function failsToLoadProfile(problem: ProblemDetail) {
  return [http.get('/v1/candidates/me/profile', ({ response }) => response(500).json(problem))];
}

export function savesProfile(saved: CandidateProfile, onSave?: (body: CandidateProfile) => void) {
  return [
    http.put('/v1/candidates/me/profile', async ({ request, response }) => {
      onSave?.(await request.json());
      return response(200).json(saved);
    }),
  ];
}

export function calculatesExperience(
  total: number,
  onCalculate?: (experiences: ProfileExperience[]) => void,
) {
  return [
    http.post('/v1/candidates/me/profile/experience-total', async ({ request, response }) => {
      const body = await request.json();
      onCalculate?.(body.experiences ?? []);
      return response(200).json({ total_experience_years: total });
    }),
  ];
}

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

export function savesPhoto(avatarUrl: string, onUpload?: (contentType: string | null) => void) {
  return [
    http.put('/v1/candidates/me/avatar', ({ request, response }) => {
      onUpload?.(request.headers.get('content-type'));
      return response(200).json({ avatar_url: avatarUrl });
    }),
  ];
}

export function refusesPhoto(problem: ProblemDetail, status: 413 | 415) {
  return [http.put('/v1/candidates/me/avatar', ({ response }) => response(status).json(problem))];
}
