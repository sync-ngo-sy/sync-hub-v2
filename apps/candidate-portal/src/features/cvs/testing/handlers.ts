import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { delay } from 'msw';
import type { Cv } from '../cv';

type Problem = components['schemas']['ProblemDetail'];
type CvProblem = components['schemas']['CvConflictProblemDetail'];
type ProfileDraft = components['schemas']['ProfileDraft'];
type CandidateProfile = components['schemas']['CandidateProfile'];

export function listsCvs(cvs: Cv[]) {
  return [http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json(cvs))];
}

/** Successive answers to the same poll: the last one is repeated once the batches run out. */
export function listsCvsInTurn(...batches: Cv[][]) {
  let call = 0;
  return [
    http.get('/v1/candidates/me/cvs', ({ response }) => {
      const batch = batches[Math.min(call, batches.length - 1)] ?? [];
      call += 1;
      return response(200).json(batch);
    }),
  ];
}

export function faultsOnListingCvs(problem: Problem) {
  return [http.get('/v1/candidates/me/cvs', ({ response }) => response(500).json(problem))];
}

/**
 * The body is deliberately never read: jsdom cannot drain a `FormData` request through MSW,
 * and awaiting it hangs the handler. What went into the multipart body is asserted where it is
 * built instead, in `use-upload-cv.test.ts`.
 */
export function acceptsUpload(cv: Cv, onRequest?: (contentType: string | null) => void) {
  return [
    http.post('/v1/candidates/me/cvs', ({ request, response }) => {
      onRequest?.(request.headers.get('content-type'));
      return response(201).json(cv);
    }),
  ];
}

/** Never answers, so the upload can be looked at while it is still in flight. */
export function withholdsUpload() {
  return [
    http.post('/v1/candidates/me/cvs', async ({ response }) => {
      await delay('infinite');
      return response(201).json({} as Cv);
    }),
  ];
}

export function refusesUpload(problem: CvProblem) {
  return [http.post('/v1/candidates/me/cvs', ({ response }) => response(409).json(problem))];
}

export function faultsOnUpload(problem: Problem) {
  return [http.post('/v1/candidates/me/cvs', ({ response }) => response(500).json(problem))];
}

export function makesCurrent(cv: Cv) {
  return [
    http.post('/v1/candidates/me/cvs/{cv_id}/make-current', ({ response }) =>
      response(200).json(cv),
    ),
  ];
}

export function refusesMakeCurrent(problem: Problem) {
  return [
    http.post('/v1/candidates/me/cvs/{cv_id}/make-current', ({ response }) =>
      response(409).json(problem),
    ),
  ];
}

export function deletesCv(onRequest?: (cvId: string) => void) {
  return [
    http.delete('/v1/candidates/me/cvs/{cv_id}', ({ params, response }) => {
      onRequest?.(params.cv_id);
      return response(204).empty();
    }),
  ];
}

export function refusesDelete(problem: Problem) {
  return [
    http.delete('/v1/candidates/me/cvs/{cv_id}', ({ response }) => response(409).json(problem)),
  ];
}

/** A fresh signed link per call, which is how a test proves none was reused. */
export function linksDownloadInTurn(...urls: string[]) {
  let call = 0;
  return [
    http.get('/v1/candidates/me/cvs/{cv_id}/download', ({ response }) => {
      const url = urls[Math.min(call, urls.length - 1)] ?? '';
      call += 1;
      return response(200).json({ url, expires_in_seconds: 60 });
    }),
  ];
}

export function drafts(draft: ProfileDraft) {
  return [
    http.get('/v1/candidates/me/cvs/{cv_id}/profile-draft', ({ response }) =>
      response(200).json(draft),
    ),
  ];
}

export function refusesDraft(problem: Problem) {
  return [
    http.get('/v1/candidates/me/cvs/{cv_id}/profile-draft', ({ response }) =>
      response(409).json(problem),
    ),
  ];
}

export function hasProfile(profile: CandidateProfile) {
  return [http.get('/v1/candidates/me/profile', ({ response }) => response(200).json(profile))];
}

export function savesProfile(onRequest?: (body: CandidateProfile) => void) {
  return [
    http.put('/v1/candidates/me/profile', async ({ request, response }) => {
      const body = (await request.json()) as CandidateProfile;
      onRequest?.(body);
      return response(200).json(body);
    }),
  ];
}

export function refusesProfile(problem: Problem) {
  return [http.put('/v1/candidates/me/profile', ({ response }) => response(500).json(problem))];
}
